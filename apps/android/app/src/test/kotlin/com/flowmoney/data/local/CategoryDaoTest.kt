package com.flowmoney.data.local

import android.content.Context
import android.database.sqlite.SQLiteConstraintException
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.data.local.dao.CategoryDao
import com.flowmoney.data.local.entity.CategoryEntity
import com.flowmoney.domain.model.CategoryRules
import com.flowmoney.domain.model.DefaultCategories
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Room real sobre SQLite en memoria (Robolectric): prueba SQL, índices y la siembra inicial. */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class CategoryDaoTest {
    private lateinit var database: AppDatabase
    private lateinit var dao: CategoryDao

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .addCallback(SeedDatabaseCallback())
            .allowMainThreadQueries()
            .build()
        dao = database.categoryDao()
    }

    @After
    fun tearDown() = database.close()

    private fun custom(name: String) =
        CategoryEntity(name = name, nameKey = CategoryRules.nameKey(name), icon = "pets", color = "#B0506B", isDefault = false)

    @Test
    fun `siembra las categorias predeterminadas al crear la base`() = runTest {
        val all = dao.observeAll().first()
        assertEquals(DefaultCategories.all.map { it.name }.sorted(), all.map { it.name }.sorted())
        assertTrue(all.all { it.isDefault })
    }

    @Test
    fun `ordena predeterminadas primero y las propias al final`() = runTest {
        dao.insert(custom("Arte"))
        val all = dao.observeAll().first()
        assertEquals(DefaultCategories.all.size + 1, all.size)
        assertTrue(all.dropLast(1).all { it.isDefault })
        assertEquals("Arte", all.last().name)
    }

    @Test
    fun `existsByNameKey ignora mayusculas y puede excluir un id`() = runTest {
        val salud = dao.observeAll().first().single { it.name == "Salud" }
        assertTrue(dao.existsByNameKey(CategoryRules.nameKey("SALUD"), excludingId = null))
        assertFalse(dao.existsByNameKey(CategoryRules.nameKey("salud"), excludingId = salud.id))
        assertFalse(dao.existsByNameKey(CategoryRules.nameKey("Mascotas"), excludingId = null))
    }

    @Test(expected = SQLiteConstraintException::class)
    fun `la base rechaza duplicados que difieren en mayusculas con tilde (QA 5)`() = runTest {
        dao.insert(custom("EDUCACIÓN")) // "Educación" ya existe entre las predeterminadas
    }

    @Test(expected = SQLiteConstraintException::class)
    fun `la base rechaza nombres repetidos aunque cambien las mayusculas`() = runTest {
        dao.insert(custom("SALUD"))
    }

    @Test
    fun `actualiza y elimina`() = runTest {
        val id = dao.insert(custom("Mascotas"))
        dao.update(custom("Mascotas y veterinaria").copy(id = id))
        assertEquals("Mascotas y veterinaria", dao.getById(id)?.name)

        assertEquals(1, dao.deleteById(id))
        assertNull(dao.getById(id))
    }
}
