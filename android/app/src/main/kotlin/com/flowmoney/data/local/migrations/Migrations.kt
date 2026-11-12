package com.flowmoney.data.local.migrations

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.flowmoney.domain.model.CategoryRules

/**
 * v1 → v2: añade `categories.name_key` y mueve la unicidad del nombre a esa columna (QA #5).
 *
 * Si una base v1 ya tiene nombres que ahora chocan (p. ej. "Educación" y "EDUCACIÓN", que NOCASE
 * permitía), se conserva el primero —las predeterminadas tienen prioridad— y los demás se renombran
 * con un sufijo " (2)", " (3)"…: no se pierde ni un dato del usuario.
 */
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE `categories` ADD COLUMN `name_key` TEXT NOT NULL DEFAULT ''")

        val rows = buildList {
            db.query("SELECT id, name FROM categories ORDER BY is_default DESC, id ASC").use { cursor ->
                while (cursor.moveToNext()) add(cursor.getLong(0) to cursor.getString(1))
            }
        }
        val takenKeys = HashSet<String>()
        for ((id, name) in rows) {
            val uniqueName = uniqueName(name, takenKeys)
            db.execSQL(
                "UPDATE categories SET name = ?, name_key = ? WHERE id = ?",
                arrayOf<Any>(uniqueName, CategoryRules.nameKey(uniqueName), id),
            )
        }

        db.execSQL("DROP INDEX IF EXISTS `index_categories_name`")
        db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_categories_name_key` ON `categories` (`name_key`)")
    }
}

/** v2 → v3: tabla de movimientos (mismo DDL que genera Room para TransactionEntity). */
val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS `transactions` (" +
                "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `amount_cents` INTEGER NOT NULL, " +
                "`description` TEXT NOT NULL, `date_epoch_day` INTEGER NOT NULL, `type` TEXT NOT NULL, " +
                "`category_id` INTEGER NOT NULL, `note` TEXT, " +
                "FOREIGN KEY(`category_id`) REFERENCES `categories`(`id`) ON UPDATE NO ACTION ON DELETE RESTRICT )",
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_transactions_category_id` ON `transactions` (`category_id`)")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_transactions_date_epoch_day` ON `transactions` (`date_epoch_day`)")
    }
}

/** Todas las migraciones, en orden. Se registran en `DatabaseModule`. */
val ALL_MIGRATIONS = arrayOf(MIGRATION_1_2, MIGRATION_2_3)

/** Devuelve [name] o, si su clave ya está usada, "[name] (n)" dentro del largo máximo permitido. */
internal fun uniqueName(name: String, takenKeys: MutableSet<String>): String {
    var candidate = name
    var suffixNumber = 2
    while (!takenKeys.add(CategoryRules.nameKey(candidate))) {
        val suffix = " ($suffixNumber)"
        candidate = name.take(CategoryRules.NAME_MAX_LENGTH - suffix.length).trimEnd() + suffix
        suffixNumber++
    }
    return candidate
}
