package com.flowmoney.domain.advisor

import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class CategoryClassifierTest {
    private val data = AdvisorTestData()
    private val categories = data.categories

    private fun suggest(text: String, type: TransactionType = TransactionType.EXPENSE, history: List<Transaction> = emptyList()) =
        CategoryClassifier.suggest(text, type, categories, history)

    @Test
    fun `reconoce comercios conocidos como en la web`() {
        assertEquals("Transporte", suggest("Uber al trabajo")?.category?.name)
        assertEquals("Entretenimiento", suggest("NETFLIX")?.category?.name)
        assertEquals("Alimentación", suggest("Almuerzo con el equipo")?.category?.name)
        assertEquals("Salud", suggest("Farmacia")?.category?.name)
    }

    @Test
    fun `ignora tildes y mayusculas`() {
        assertEquals(suggest("farmacia")?.category, suggest("FÁRMACIA")?.category)
    }

    @Test
    fun `una frase es mas especifica que una palabra suelta`() {
        val suggestion = suggest("uber eats pizza")!!
        assertEquals("Alimentación", suggestion.category.name)
        assertEquals("uber eats", suggestion.matched)
    }

    @Test
    fun `sin pistas no sugiere nada`() {
        assertNull(suggest("xyz"))
        assertNull(suggest("a"))
        assertNull(CategoryClassifier.suggest("uber", TransactionType.EXPENSE, emptyList()))
    }

    @Test
    fun `un ingreso sin pistas sugiere salario`() {
        val suggestion = suggest("Venta de garaje", TransactionType.INCOME)!!
        assertEquals("Salario", suggestion.category.name)
        assertEquals(SuggestionSource.INCOME_DEFAULT, suggestion.source)
    }

    @Test
    fun `tu historial pesa mas que las reglas`() {
        // El usuario anota "Uber" en Entretenimiento (salidas): se respeta su costumbre.
        val history = listOf(
            Transaction(1, 1500, "Uber", LocalDate.of(2026, 10, 1), TransactionType.EXPENSE, data.fun_.id),
            Transaction(2, 1800, "uber", LocalDate.of(2026, 10, 8), TransactionType.EXPENSE, data.fun_.id),
        )
        val suggestion = suggest("Uber", history = history)!!
        assertEquals(data.fun_, suggestion.category)
        assertEquals(SuggestionSource.HISTORY, suggestion.source)
        assertEquals(2, suggestion.timesUsed)
        assertTrue(suggestion.confidence > 0.96)
    }

    @Test
    fun `reconoce mientras se escribe una descripcion ya usada`() {
        val history = listOf(Transaction(1, 4990, "Gimnasio Smart Fit", LocalDate.of(2026, 10, 3), TransactionType.EXPENSE, data.fun_.id))
        val suggestion = suggest("gimn", history = history)!!
        assertEquals(data.fun_, suggestion.category)
        assertEquals("Gimnasio Smart Fit", suggestion.matched)
    }

    @Test
    fun `a igual uso gana la categoria mas reciente`() {
        val history = listOf(
            Transaction(1, 1000, "Regalo", LocalDate.of(2026, 9, 1), TransactionType.EXPENSE, data.home.id),
            Transaction(2, 1000, "Regalo", LocalDate.of(2026, 10, 1), TransactionType.EXPENSE, data.fun_.id),
        )
        assertEquals(data.fun_, suggest("regalo", history = history)!!.category)
    }

    @Test
    fun `el historial ignora categorias borradas y movimientos de otro tipo`() {
        val history = listOf(
            Transaction(1, 1000, "Uber", LocalDate.of(2026, 10, 1), TransactionType.EXPENSE, 999),
            Transaction(2, 1000, "Uber", LocalDate.of(2026, 10, 2), TransactionType.INCOME, data.salary.id),
        )
        assertEquals("Transporte", suggest("Uber", history = history)!!.category.name)
    }

    @Test
    fun `reconoce el nombre de una categoria propia`() {
        val pets = Category(id = 50, name = "Mascotas", icon = "pets", color = "#B0506B")
        val suggestion = CategoryClassifier.suggest("Vacuna para mascotas", TransactionType.EXPENSE, categories + pets)!!
        assertEquals(pets, suggestion.category)
        assertEquals(SuggestionSource.CATEGORY_NAME, suggestion.source)
    }
}
