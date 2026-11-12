package com.flowmoney.data.local

import android.content.Context
import android.database.sqlite.SQLiteConstraintException
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.data.local.entity.CategoryEntity
import com.flowmoney.data.repository.BudgetRepositoryImpl
import com.flowmoney.data.repository.TransactionRepositoryImpl
import com.flowmoney.domain.model.Budget
import com.flowmoney.domain.model.CategoryRules
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate
import java.time.YearMonth

/** Room real (SQLite en memoria): clave (mes, categoría), copia sin pisar, CASCADE y gasto por categoría. */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class BudgetDaoTest {
    private lateinit var database: AppDatabase
    private lateinit var budgets: BudgetRepositoryImpl
    private lateinit var transactions: TransactionRepositoryImpl
    private var foodId = 0L
    private var transportId = 0L

    private val october = YearMonth.of(2026, 10)
    private val november = YearMonth.of(2026, 11)

    @Before
    fun setUp() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .addCallback(SeedDatabaseCallback())
            .allowMainThreadQueries()
            .build()
        budgets = BudgetRepositoryImpl(database.budgetDao())
        transactions = TransactionRepositoryImpl(database.transactionDao())
        val categories = database.categoryDao().observeAll().first()
        foodId = categories.single { it.name == "Alimentación" }.id
        transportId = categories.single { it.name == "Transporte" }.id
    }

    @After
    fun tearDown() = database.close()

    @Test
    fun `upsert crea y reemplaza el limite de la categoria en ese mes`() = runTest {
        budgets.upsert(Budget(foodId, november, 30_000))
        budgets.upsert(Budget(foodId, november, 25_000))
        budgets.upsert(Budget(foodId, october, 20_000))

        assertEquals(listOf(Budget(foodId, november, 25_000)), budgets.observe(november).first())
        assertEquals(20_000L, budgets.get(foodId, october)?.limitCents)
    }

    @Test
    fun `el ultimo mes anterior con presupuestos se busca hacia atras`() = runTest {
        assertTrue(budgets.observeLatestBefore(november).first().isEmpty())

        budgets.upsert(Budget(foodId, YearMonth.of(2026, 7), 1_000))
        budgets.upsert(Budget(foodId, YearMonth.of(2026, 9), 2_000))
        budgets.upsert(Budget(transportId, YearMonth.of(2026, 9), 3_000))
        budgets.upsert(Budget(foodId, november, 4_000))

        val latest = budgets.observeLatestBefore(november).first()
        assertEquals(setOf(foodId to 2_000L, transportId to 3_000L), latest.map { it.categoryId to it.limitCents }.toSet())
        assertTrue(latest.all { it.month == YearMonth.of(2026, 9) })
    }

    @Test
    fun `insertMissing no pisa los existentes y cuenta solo los nuevos`() = runTest {
        budgets.upsert(Budget(foodId, november, 9_000))

        val inserted = budgets.insertMissing(listOf(Budget(foodId, november, 1), Budget(transportId, november, 5_000)))

        assertEquals(1, inserted)
        assertEquals(9_000L, budgets.get(foodId, november)?.limitCents)
        assertEquals(5_000L, budgets.get(transportId, november)?.limitCents)
    }

    @Test
    fun `borrar una categoria se lleva sus presupuestos`() = runTest {
        val petsId = database.categoryDao().insert(
            CategoryEntity(name = "Mascotas", nameKey = CategoryRules.nameKey("Mascotas"), icon = "pets", color = "#B0506B", isDefault = false),
        )
        budgets.upsert(Budget(petsId, november, 8_000))

        database.categoryDao().deleteById(petsId)

        assertNull(budgets.get(petsId, november))
    }

    @Test(expected = SQLiteConstraintException::class)
    fun `la base rechaza un presupuesto de una categoria inexistente`() = runTest {
        budgets.upsert(Budget(9_999, november, 1_000))
    }

    @Test
    fun `quitar un presupuesto`() = runTest {
        budgets.upsert(Budget(foodId, november, 1_000))
        budgets.delete(foodId, november)
        assertNull(budgets.get(foodId, november))
    }

    @Test
    fun `gasto por categoria del mes sin ingresos ni otros meses`() = runTest {
        suspend fun add(cents: Long, categoryId: Long, date: LocalDate, type: TransactionType = TransactionType.EXPENSE) {
            transactions.insert(Transaction(amountCents = cents, description = "x", date = date, type = type, categoryId = categoryId))
        }
        add(1_000, foodId, LocalDate.of(2026, 11, 1))
        add(2_550, foodId, LocalDate.of(2026, 11, 30))
        add(700, transportId, LocalDate.of(2026, 11, 15))
        add(99_000, foodId, LocalDate.of(2026, 11, 15), TransactionType.INCOME)
        add(5_000, foodId, LocalDate.of(2026, 10, 31))
        add(5_000, foodId, LocalDate.of(2026, 12, 1))

        assertEquals(mapOf(foodId to 3_550L, transportId to 700L), transactions.observeExpensesByCategory(november).first())
    }
}
