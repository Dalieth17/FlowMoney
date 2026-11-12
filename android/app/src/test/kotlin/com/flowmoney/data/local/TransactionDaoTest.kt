package com.flowmoney.data.local

import android.content.Context
import android.database.sqlite.SQLiteConstraintException
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flowmoney.data.repository.TransactionRepositoryImpl
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionFilter
import com.flowmoney.domain.model.TransactionType
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate
import java.time.YearMonth

/** Room real (SQLite en memoria) a través del repositorio: SQL, JOIN, filtros, orden y clave foránea. */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class TransactionDaoTest {
    private lateinit var database: AppDatabase
    private lateinit var repository: TransactionRepositoryImpl
    private var foodId = 0L
    private var salaryId = 0L

    private val november = YearMonth.of(2026, 11)

    @Before
    fun setUp() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .addCallback(SeedDatabaseCallback())
            .allowMainThreadQueries()
            .build()
        repository = TransactionRepositoryImpl(database.transactionDao())
        val categories = database.categoryDao().observeAll().first()
        foodId = categories.single { it.name == "Alimentación" }.id
        salaryId = categories.single { it.name == "Salario" }.id
    }

    @After
    fun tearDown() = database.close()

    private suspend fun add(
        description: String,
        date: LocalDate,
        type: TransactionType = TransactionType.EXPENSE,
        categoryId: Long = foodId,
        cents: Long = 1_000,
    ): Long = repository.insert(Transaction(amountCents = cents, description = description, date = date, type = type, categoryId = categoryId))

    @Test
    fun `filtra por mes incluyendo el primer y el ultimo dia`() = runTest {
        add("Fin de octubre", LocalDate.of(2026, 10, 31))
        add("Primero", LocalDate.of(2026, 11, 1))
        add("Ultimo", LocalDate.of(2026, 11, 30))
        add("Diciembre", LocalDate.of(2026, 12, 1))

        val items = repository.observe(TransactionFilter(november)).first()
        assertEquals(listOf("Ultimo", "Primero"), items.map { it.transaction.description })
    }

    @Test
    fun `ordena por fecha descendente y luego por id descendente`() = runTest {
        add("A", LocalDate.of(2026, 11, 5))
        add("B", LocalDate.of(2026, 11, 7))
        add("C", LocalDate.of(2026, 11, 5))

        val items = repository.observe(TransactionFilter(november)).first()
        assertEquals(listOf("B", "C", "A"), items.map { it.transaction.description })
    }

    @Test
    fun `filtra por tipo y por categoria y trae la categoria unida`() = runTest {
        add("Almuerzo", LocalDate.of(2026, 11, 3))
        add("Sueldo", LocalDate.of(2026, 11, 1), TransactionType.INCOME, salaryId, cents = 420_000)

        val incomes = repository.observe(TransactionFilter(november, type = TransactionType.INCOME)).first()
        assertEquals(listOf("Sueldo"), incomes.map { it.transaction.description })
        assertEquals("Salario", incomes.single().category.name)
        assertEquals(420_000L, incomes.single().transaction.amountCents)

        val food = repository.observe(TransactionFilter(november, categoryId = foodId)).first()
        assertEquals(listOf("Almuerzo"), food.map { it.transaction.description })
    }

    @Test
    fun `guarda la nota opcional y la fecha sin desplazarla`() = runTest {
        val date = LocalDate.of(2026, 11, 12)
        val id = repository.insert(
            Transaction(amountCents = 1, description = "Chicle", date = date, type = TransactionType.EXPENSE, categoryId = foodId, note = "Kiosco"),
        )
        val stored = repository.getById(id)!!
        assertEquals(date, stored.date)
        assertEquals("Kiosco", stored.note)

        repository.update(stored.copy(note = null, amountCents = 250))
        assertNull(repository.getById(id)!!.note)
        assertEquals(250L, repository.getById(id)!!.amountCents)
    }

    @Test
    fun `cuenta por categoria y elimina`() = runTest {
        val id = add("Cena", LocalDate.of(2026, 11, 2))
        add("Desayuno", LocalDate.of(2026, 11, 3))
        assertEquals(2, repository.countByCategory(foodId))

        repository.delete(id)
        assertNull(repository.getById(id))
        assertEquals(1, repository.countByCategory(foodId))
    }

    @Test(expected = SQLiteConstraintException::class)
    fun `la base impide borrar una categoria con movimientos`() = runTest {
        add("Cena", LocalDate.of(2026, 11, 2))
        database.categoryDao().deleteById(foodId)
    }

    @Test(expected = SQLiteConstraintException::class)
    fun `la base rechaza un movimiento con una categoria inexistente`() = runTest {
        add("Huerfano", LocalDate.of(2026, 11, 2), categoryId = 9_999)
    }
}
