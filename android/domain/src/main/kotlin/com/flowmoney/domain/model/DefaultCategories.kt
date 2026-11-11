package com.flowmoney.domain.model

/** Categorías con las que arranca la app (mismas que la versión web). */
object DefaultCategories {
    val all: List<Category> = listOf(
        Category(name = "Alimentación", icon = "restaurant", color = "#C25A44", isDefault = true),
        Category(name = "Transporte", icon = "directions_bus", color = "#3E78A8", isDefault = true),
        Category(name = "Entretenimiento", icon = "movie", color = "#7A5BA8", isDefault = true),
        Category(name = "Salud", icon = "medical_services", color = "#5B9E86", isDefault = true),
        Category(name = "Educación", icon = "school", color = "#D9A648", isDefault = true),
        Category(name = "Servicios", icon = "lightbulb", color = "#C08A3E", isDefault = true),
        Category(name = "Hogar", icon = "home", color = "#A86A54", isDefault = true),
        Category(name = "Salario", icon = "work", color = "#1F4D3A", isDefault = true),
        Category(name = "Otros", icon = "category", color = "#8A94A6", isDefault = true),
    )
}
