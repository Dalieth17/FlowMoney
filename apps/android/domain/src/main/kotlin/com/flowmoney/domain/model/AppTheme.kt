package com.flowmoney.domain.model

/** Tema de colores que elige la persona. Solo cambia la apariencia, nunca los datos. */
enum class AppTheme {
    /** "Verde y negro": fondo casi negro con un único acento verde. Es el predeterminado. */
    GREEN,

    /** "Blanco y negro": fondo blanco y solo tinta negra. */
    MONO,
    ;

    companion object {
        val Default = GREEN
    }
}
