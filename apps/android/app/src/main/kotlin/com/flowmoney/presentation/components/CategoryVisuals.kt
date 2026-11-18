package com.flowmoney.presentation.components

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CardGiftcard
import androidx.compose.material.icons.rounded.Category
import androidx.compose.material.icons.rounded.Checkroom
import androidx.compose.material.icons.rounded.CreditCard
import androidx.compose.material.icons.rounded.DirectionsBus
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.Flight
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Lightbulb
import androidx.compose.material.icons.rounded.LocalCafe
import androidx.compose.material.icons.rounded.MedicalServices
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.Pets
import androidx.compose.material.icons.rounded.PhoneAndroid
import androidx.compose.material.icons.rounded.Restaurant
import androidx.compose.material.icons.rounded.Savings
import androidx.compose.material.icons.rounded.School
import androidx.compose.material.icons.rounded.ShoppingCart
import androidx.compose.material.icons.rounded.SportsEsports
import androidx.compose.material.icons.rounded.Work
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.flowmoney.R
import com.flowmoney.util.readableContentColor
import com.flowmoney.util.toColorOrNull

/** Ícono que se asigna a una categoría nueva si el usuario no elige otro. */
const val DEFAULT_CATEGORY_ICON = "category"

/** Opción de ícono: la clave se guarda en la base de datos; la etiqueta es para lectores de pantalla. */
data class CategoryIconOption(val key: String, val vector: ImageVector, @StringRes val label: Int)

/** Catálogo de íconos disponibles para categorías (las claves coinciden con DefaultCategories). */
object CategoryIcons {
    val options: List<CategoryIconOption> = listOf(
        CategoryIconOption("restaurant", Icons.Rounded.Restaurant, R.string.icon_restaurant),
        CategoryIconOption("directions_bus", Icons.Rounded.DirectionsBus, R.string.icon_directions_bus),
        CategoryIconOption("movie", Icons.Rounded.Movie, R.string.icon_movie),
        CategoryIconOption("medical_services", Icons.Rounded.MedicalServices, R.string.icon_medical_services),
        CategoryIconOption("school", Icons.Rounded.School, R.string.icon_school),
        CategoryIconOption("lightbulb", Icons.Rounded.Lightbulb, R.string.icon_lightbulb),
        CategoryIconOption("home", Icons.Rounded.Home, R.string.icon_home),
        CategoryIconOption("work", Icons.Rounded.Work, R.string.icon_work),
        CategoryIconOption("category", Icons.Rounded.Category, R.string.icon_category),
        CategoryIconOption("shopping_cart", Icons.Rounded.ShoppingCart, R.string.icon_shopping_cart),
        CategoryIconOption("local_cafe", Icons.Rounded.LocalCafe, R.string.icon_local_cafe),
        CategoryIconOption("flight", Icons.Rounded.Flight, R.string.icon_flight),
        CategoryIconOption("card_giftcard", Icons.Rounded.CardGiftcard, R.string.icon_card_giftcard),
        CategoryIconOption("credit_card", Icons.Rounded.CreditCard, R.string.icon_credit_card),
        CategoryIconOption("phone_android", Icons.Rounded.PhoneAndroid, R.string.icon_phone_android),
        CategoryIconOption("checkroom", Icons.Rounded.Checkroom, R.string.icon_checkroom),
        CategoryIconOption("pets", Icons.Rounded.Pets, R.string.icon_pets),
        CategoryIconOption("fitness_center", Icons.Rounded.FitnessCenter, R.string.icon_fitness_center),
        CategoryIconOption("savings", Icons.Rounded.Savings, R.string.icon_savings),
        CategoryIconOption("sports_esports", Icons.Rounded.SportsEsports, R.string.icon_sports_esports),
    )

    private val byKey = options.associateBy { it.key }

    /** Ícono para una clave guardada; si la clave es desconocida, uno genérico. */
    fun vectorFor(key: String): ImageVector = byKey[key]?.vector ?: Icons.Rounded.Category
}

data class PaletteColor(val hex: String, @StringRes val label: Int)

/** Paleta para categorías (la misma de la web). */
object CategoryPalette {
    const val DEFAULT_COLOR = "#C25A44"

    val colors: List<PaletteColor> = listOf(
        PaletteColor("#C25A44", R.string.color_clay),
        PaletteColor("#3E78A8", R.string.color_blue),
        PaletteColor("#7A5BA8", R.string.color_violet),
        PaletteColor("#5B9E86", R.string.color_teal),
        PaletteColor("#D9A648", R.string.color_amber),
        PaletteColor("#C08A3E", R.string.color_brass),
        PaletteColor("#A86A54", R.string.color_terracotta),
        PaletteColor("#1F4D3A", R.string.color_pine),
        PaletteColor("#6B8F7D", R.string.color_sage),
        PaletteColor("#8A94A6", R.string.color_slate),
        PaletteColor("#B0506B", R.string.color_raspberry),
        PaletteColor("#4E86B0", R.string.color_sky),
    )
}

/** Círculo de color con el ícono de la categoría (decorativo: el nombre va al lado). */
@Composable
fun CategoryAvatar(
    iconKey: String,
    colorHex: String,
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
) {
    val background = colorHex.toColorOrNull() ?: MaterialTheme.colorScheme.secondary
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(background),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = CategoryIcons.vectorFor(iconKey),
            contentDescription = null,
            tint = background.readableContentColor(),
            modifier = Modifier.size(size * 0.5f),
        )
    }
}
