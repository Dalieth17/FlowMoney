package com.flowmoney.data.local

import android.content.Context
import androidx.room.Room
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.SupportSQLiteOpenHelper
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.data.local.migrations.ALL_MIGRATIONS
import com.flowmoney.data.local.migrations.uniqueName
import com.flowmoney.domain.model.CategoryRules
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * Migraciones sobre una base real en disco: se crea a mano la versión antigua (con el DDL
 * exacto que generaba Room) y se abre con la versión actual. Room valida el esquema resultante
 * contra las entidades, así que si la migración deja algo distinto, el test falla.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class MigrationTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val dbName = "migration-test.db"

    @Before
    fun setUp() {
        context.deleteDatabase(dbName)
    }

    @After
    fun tearDown() {
        context.deleteDatabase(dbName)
    }

    /** Crea la base v1 tal como la dejaba la versión 0.1.0 de la app. */
    private fun createVersion1(insertRows: SupportSQLiteDatabase.() -> Unit) {
        val callback = object : SupportSQLiteOpenHelper.Callback(1) {
            override fun onCreate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `categories` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "`name` TEXT NOT NULL COLLATE NOCASE, `icon` TEXT NOT NULL, `color` TEXT NOT NULL, " +
                        "`is_default` INTEGER NOT NULL)",
                )
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_categories_name` ON `categories` (`name`)")
            }

            override fun onUpgrade(db: SupportSQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
        }
        val config = SupportSQLiteOpenHelper.Configuration.builder(context).name(dbName).callback(callback).build()
        FrameworkSQLiteOpenHelperFactory().create(config).apply {
            writableDatabase.insertRows()
            close()
        }
    }

    @Test
    fun `de 1 a 2 conserva los datos y renombra duplicados que v1 dejaba pasar (QA 5)`() = runTest {
        createVersion1 {
            execSQL("INSERT INTO categories (name, icon, color, is_default) VALUES ('Educación', 'school', '#D9A648', 1)")
            execSQL("INSERT INTO categories (name, icon, color, is_default) VALUES ('EDUCACIÓN', 'school', '#3E78A8', 0)")
            execSQL("INSERT INTO categories (name, icon, color, is_default) VALUES ('Mascotas', 'pets', '#B0506B', 0)")
        }

        val database = Room.databaseBuilder(context, AppDatabase::class.java, dbName)
            .addMigrations(*ALL_MIGRATIONS)
            .allowMainThreadQueries()
            .build()
        try {
            val names = database.categoryDao().observeAll().first().map { it.name }
            assertEquals(listOf("Educación", "EDUCACIÓN (2)", "Mascotas"), names)
            // La nueva regla ya rige sobre la base migrada.
            assertTrue(database.categoryDao().existsByNameKey(CategoryRules.nameKey("educación"), excludingId = null))
        } finally {
            database.close()
        }
    }

    @Test
    fun `uniqueName agrega sufijos sin pasar el largo maximo`() {
        val taken = mutableSetOf(CategoryRules.nameKey("Viajes"), CategoryRules.nameKey("Viajes (2)"))
        assertEquals("VIAJES (3)", uniqueName("VIAJES", taken))

        val long = "x".repeat(CategoryRules.NAME_MAX_LENGTH)
        val renamed = uniqueName(long, mutableSetOf(CategoryRules.nameKey(long)))
        assertEquals(CategoryRules.NAME_MAX_LENGTH, renamed.length)
        assertTrue(renamed.endsWith(" (2)"))
    }
}
