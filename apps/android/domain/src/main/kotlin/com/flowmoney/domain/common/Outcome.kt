package com.flowmoney.domain.common

/**
 * Resultado de una operación de dominio: éxito con un valor o fallo con un error tipado.
 * Se prefiere a las excepciones para que cada caso de error sea explícito y exhaustivo en `when`.
 */
sealed interface Outcome<out T, out E> {
    data class Success<out T>(val value: T) : Outcome<T, Nothing>

    data class Failure<out E>(val error: E) : Outcome<Nothing, E>
}
