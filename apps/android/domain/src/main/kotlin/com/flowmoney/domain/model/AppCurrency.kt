package com.flowmoney.domain.model

/** Moneda en la que la persona maneja su dinero. Solo cambia cómo se muestran los montos: no convierte. */
enum class AppCurrency {
    /** Peso colombiano: sin centavos en la práctica ("$ 4.500.000"). */
    COP,

    /** Dólar estadounidense: siempre con 2 decimales ("US$ 1,234.56"). */
    USD,
}
