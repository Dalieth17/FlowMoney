package com.flowmoney.data.repository

import com.flowmoney.data.local.entity.CategoryEntity
import com.flowmoney.domain.model.Category

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
    icon = icon,
    color = color,
    isDefault = isDefault,
)
