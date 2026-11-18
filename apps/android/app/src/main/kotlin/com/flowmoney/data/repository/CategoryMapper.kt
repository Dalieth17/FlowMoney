package com.flowmoney.data.repository

import com.flowmoney.data.local.entity.CategoryEntity
import com.flowmoney.domain.model.Category
import com.flowmoney.domain.model.CategoryRules

internal fun CategoryEntity.toDomain() = Category(
    id = id,
    name = name,
    icon = icon,
    color = color,
    isDefault = isDefault,
)

internal fun Category.toEntity() = CategoryEntity(
    id = id,
    name = name,
    nameKey = CategoryRules.nameKey(name),
    icon = icon,
    color = color,
    isDefault = isDefault,
)
