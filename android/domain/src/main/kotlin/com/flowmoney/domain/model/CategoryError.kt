package com.flowmoney.domain.model

/** Errores de negocio al crear, editar o eliminar categorías. */
sealed interface CategoryError {
    data object BlankName : CategoryError

    data class NameTooLong(val max: Int) : CategoryError

    data object DuplicateName : CategoryError

    data object InvalidIcon : CategoryError

    data object InvalidColor : CategoryError

    data object NotFound : CategoryError

    data object DefaultCannotBeDeleted : CategoryError
}
