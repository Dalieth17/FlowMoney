package com.flowmoney.domain.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CategoryRulesTest {
    @Test
    fun `normaliza espacios del nombre`() {
        assertEquals("Comida rápida", CategoryRules.normalizeName("  Comida   rápida "))
    }

    @Test
    fun `la clave de nombre ignora mayusculas tambien con tildes (QA 5)`() {
        val key = CategoryRules.nameKey("Educación")
        assertEquals(key, CategoryRules.nameKey("EDUCACIÓN"))
        assertEquals(key, CategoryRules.nameKey("  educación "))
        assertEquals(key, CategoryRules.nameKey("Educacio\u0301n")) // "o" + tilde combinada (NFD)
        assertEquals(CategoryRules.nameKey("Straße"), CategoryRules.nameKey("STRASSE"))
    }

    @Test
    fun `las tildes y la enie siguen distinguiendo palabras`() {
        assertNotEquals(CategoryRules.nameKey("Educación"), CategoryRules.nameKey("Educacion"))
        assertNotEquals(CategoryRules.nameKey("Año"), CategoryRules.nameKey("Ano"))
    }

    @Test
    fun `valida nombre, icono y color`() {
        assertNull(CategoryRules.validate("Mascotas", "pets", "#B0506B"))
        assertEquals(CategoryError.BlankName, CategoryRules.validate("", "pets", "#B0506B"))
        assertEquals(CategoryError.NameTooLong(40), CategoryRules.validate("x".repeat(41), "pets", "#B0506B"))
        assertEquals(CategoryError.InvalidIcon, CategoryRules.validate("Mascotas", " ", "#B0506B"))
        assertEquals(CategoryError.InvalidColor, CategoryRules.validate("Mascotas", "pets", "rojo"))
        assertEquals(CategoryError.InvalidColor, CategoryRules.validate("Mascotas", "pets", "#B0506"))
    }

    @Test
    fun `las categorias predeterminadas cumplen las reglas y no se repiten`() {
        val all = DefaultCategories.all
        assertEquals(9, all.size)
        all.forEach { assertNull("${it.name} inválida", CategoryRules.validate(it.name, it.icon, it.color)) }
        assertEquals(all.size, all.map { it.name.lowercase() }.toSet().size)
        assertEquals(true, all.all { it.isDefault })
    }
}
