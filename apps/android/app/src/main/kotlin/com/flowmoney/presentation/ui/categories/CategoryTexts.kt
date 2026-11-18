package com.flowmoney.presentation.ui.categories

import android.content.res.Resources
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import com.flowmoney.R
import com.flowmoney.domain.model.CategoryError

/** Traduce errores de dominio a texto para el usuario (el dominio no conoce recursos de Android). */
fun CategoryError.text(resources: Resources): String = when (this) {
    CategoryError.BlankName -> resources.getString(R.string.error_category_blank_name)
    is CategoryError.NameTooLong -> resources.getString(R.string.error_category_name_too_long, max)
    CategoryError.DuplicateName -> resources.getString(R.string.error_category_duplicate)
    CategoryError.InvalidIcon -> resources.getString(R.string.error_category_invalid_icon)
    CategoryError.InvalidColor -> resources.getString(R.string.error_category_invalid_color)
    CategoryError.NotFound -> resources.getString(R.string.error_category_not_found)
    CategoryError.DefaultCannotBeDeleted -> resources.getString(R.string.error_category_default_delete)
    is CategoryError.InUse ->
        resources.getQuantityString(R.plurals.error_category_in_use, transactionCount, transactionCount)
}

@Composable
fun CategoryError.text(): String = text(LocalContext.current.resources)

fun CategoriesMessage.text(resources: Resources): String = when (this) {
    is CategoriesMessage.Created -> resources.getString(R.string.message_category_created, name)
    CategoriesMessage.Updated -> resources.getString(R.string.message_category_updated)
    is CategoriesMessage.Deleted -> resources.getString(R.string.message_category_deleted, name)
    is CategoriesMessage.Failed -> error.text(resources)
}

/** Errores que se muestran debajo del campo de nombre (el resto, al pie del formulario). */
internal val CategoryError.belongsToNameField: Boolean
    get() = this is CategoryError.BlankName || this is CategoryError.NameTooLong || this is CategoryError.DuplicateName
