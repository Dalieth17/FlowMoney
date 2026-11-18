package com.flowmoney.domain.advisor

import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.Transaction
import com.flowmoney.domain.model.TransactionType

/** De dónde sale una sugerencia: lo que el usuario ya hizo pesa más que una regla genérica. */
enum class SuggestionSource {
    /** Ya registraste un movimiento con esta misma descripción. */
    HISTORY,

    /** La descripción contiene el nombre de una de tus categorías. */
    CATEGORY_NAME,

    /** Coincide con un comercio o palabra conocida ("uber", "netflix"…). */
    KEYWORD,

    /** Un ingreso sin otra pista casi siempre es el sueldo. */
    INCOME_DEFAULT,
}

/**
 * Categoría sugerida para una descripción.
 *
 * @property confidence 0..1; la interfaz solo la aplica sola desde [CategoryClassifier.AUTO_APPLY].
 * @property matched la palabra o descripción que disparó la sugerencia (para explicarla).
 * @property timesUsed cuántas veces usaste esa categoría con esta descripción (solo [SuggestionSource.HISTORY]).
 */
data class CategorySuggestion(
    val category: Category,
    val confidence: Double,
    val source: SuggestionSource,
    val matched: String,
    val timesUsed: Int = 0,
)

/**
 * Clasificador local (sin red) de movimientos. Combina, de más a menos fiable:
 * 1. tu historial: si ya clasificaste "Netflix" como Entretenimiento, se repite;
 * 2. el nombre de tus categorías (también las propias, como "Mascotas");
 * 3. las reglas por palabra clave de la web ([KEYWORD_RULES]).
 */
object CategoryClassifier {
    /** Desde esta confianza la sugerencia se aplica sola si el usuario no eligió categoría. */
    const val AUTO_APPLY = 0.75

    private const val HISTORY_REPEATED = 0.99
    private const val HISTORY_ONCE = 0.97 // gana a una palabra clave exacta: tu costumbre manda
    private const val HISTORY_PREFIX = 0.85
    private const val CATEGORY_NAME = 0.97
    private const val PHRASE = 0.98
    private const val EXACT_TOKEN = 0.96
    private const val LONG_SUBSTRING = 0.9
    private const val INCOME_FALLBACK = 0.7

    private const val MIN_TEXT = 2
    private const val MIN_PREFIX = 3
    private const val MIN_SUBSTRING_LENGTH = 5

    private val RULES: List<Pair<String, List<String>>> =
        KEYWORD_RULES.map { (name, words) -> TextNormalizer.normalize(name) to words.map(TextNormalizer::normalize).distinct() }

    /**
     * @param categories categorías existentes (la sugerencia siempre es una de ellas).
     * @param history movimientos anteriores, de cualquier orden; los más recientes desempatan.
     */
    fun suggest(
        description: String,
        type: TransactionType,
        categories: List<Category>,
        history: List<Transaction> = emptyList(),
    ): CategorySuggestion? {
        val text = TextNormalizer.normalize(description)
        if (text.length < MIN_TEXT || categories.isEmpty()) return null
        val tokens = TextNormalizer.tokens(text)
        val byId = categories.associateBy { it.id }
        val byName = categories.associateBy { TextNormalizer.normalize(it.name) }

        val candidates = listOfNotNull(
            fromHistory(text, type, history, byId),
            fromCategoryName(text, tokens, categories),
            fromKeywords(text, tokens, byName),
        )
        val best = candidates.maxByOrNull { it.confidence }

        if (type == TransactionType.INCOME && (best == null || best.confidence < LONG_SUBSTRING)) {
            val salary = byName[TextNormalizer.normalize("Salario")]
            if (salary != null) return CategorySuggestion(salary, maxOf(best?.confidence ?: 0.0, INCOME_FALLBACK), SuggestionSource.INCOME_DEFAULT, "ingreso")
        }
        return best
    }

    private fun fromHistory(
        text: String,
        type: TransactionType,
        history: List<Transaction>,
        byId: Map<Long, Category>,
    ): CategorySuggestion? {
        val sameType = history.filter { it.type == type && it.categoryId in byId }
        val exact = sameType.filter { TextNormalizer.normalize(it.description) == text }
        if (exact.isNotEmpty()) {
            val (categoryId, uses) = mostUsed(exact)
            val confidence = if (uses.size >= 2) HISTORY_REPEATED else HISTORY_ONCE
            return CategorySuggestion(byId.getValue(categoryId), confidence, SuggestionSource.HISTORY, uses.first().description, uses.size)
        }
        if (text.length < MIN_PREFIX) return null
        // Mientras se escribe: "netf" ya reconoce "Netflix".
        val prefix = sameType.filter { TextNormalizer.normalize(it.description).startsWith(text) }
        if (prefix.isEmpty()) return null
        val (categoryId, uses) = mostUsed(prefix)
        return CategorySuggestion(byId.getValue(categoryId), HISTORY_PREFIX, SuggestionSource.HISTORY, uses.first().description, uses.size)
    }

    /** Categoría más usada; a igual uso, la del movimiento más reciente. Los usos van del más reciente al más antiguo. */
    private fun mostUsed(matches: List<Transaction>): Pair<Long, List<Transaction>> {
        val recentFirst = matches.sortedWith(compareByDescending<Transaction> { it.date }.thenByDescending { it.id })
        val groups = recentFirst.groupBy { it.categoryId }
        val best = groups.entries.maxWith(
            compareBy<Map.Entry<Long, List<Transaction>>> { it.value.size }
                .thenBy { -recentFirst.indexOf(it.value.first()) },
        )
        return best.key to best.value
    }

    private fun fromCategoryName(text: String, tokens: Set<String>, categories: List<Category>): CategorySuggestion? =
        categories.firstNotNullOfOrNull { category ->
            val name = TextNormalizer.normalize(category.name)
            val matches = if (name.contains(' ')) text.contains(name) else name in tokens
            if (name.length >= MIN_PREFIX && matches) CategorySuggestion(category, CATEGORY_NAME, SuggestionSource.CATEGORY_NAME, category.name) else null
        }

    private fun fromKeywords(text: String, tokens: Set<String>, byName: Map<String, Category>): CategorySuggestion? {
        var best: CategorySuggestion? = null
        for ((name, keywords) in RULES) {
            val category = byName[name] ?: continue // la renombraron o no existe
            for (keyword in keywords) {
                val score = score(keyword, text, tokens)
                if (score > (best?.confidence ?: 0.0)) best = CategorySuggestion(category, score, SuggestionSource.KEYWORD, keyword)
            }
        }
        return best
    }

    // Más específico gana: "uber eats" (frase) vence a "uber" (palabra).
    private fun score(keyword: String, text: String, tokens: Set<String>): Double = when {
        keyword.contains(' ') -> if (text.contains(keyword)) PHRASE else 0.0
        keyword in tokens -> EXACT_TOKEN
        keyword.length >= MIN_SUBSTRING_LENGTH && text.contains(keyword) -> LONG_SUBSTRING
        else -> 0.0
    }
}
