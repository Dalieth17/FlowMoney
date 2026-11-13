package com.flowmoney.domain.advisor

import com.flowmoney.domain.model.Category

/** Regla 50/30/20: necesidades, gustos y ahorro. */
enum class SpendingKind { NEEDS, WANTS, SAVINGS }

/**
 * A qué grupo de la regla 50/30/20 pertenece una categoría. Se decide por su ícono (las propias
 * también lo tienen) y, si el nombre lo deja claro, por palabras como "alquiler" o "ahorro".
 */
object SpendingKinds {
    private val NEEDS_ICONS = setOf(
        "restaurant", "shopping_cart", "directions_bus", "medical_services", "school",
        "lightbulb", "home", "phone_android", "credit_card", "pets",
    )
    private val SAVINGS_ICONS = setOf("savings")
    private val NEEDS_WORDS = listOf(
        "alquiler", "renta", "hipoteca", "luz", "agua", "gas", "internet", "seguro", "deuda",
        "prestamo", "credito", "colegio", "universidad", "farmacia", "salud", "transporte", "mercado",
    )
    private val SAVINGS_WORDS = listOf("ahorro", "inversion", "fondo", "jubilacion", "pension")

    fun of(category: Category): SpendingKind {
        val tokens = TextNormalizer.tokens(category.name)
        return when {
            category.icon in SAVINGS_ICONS || SAVINGS_WORDS.any { it in tokens } -> SpendingKind.SAVINGS
            category.icon in NEEDS_ICONS || NEEDS_WORDS.any { it in tokens } -> SpendingKind.NEEDS
            else -> SpendingKind.WANTS
        }
    }
}
