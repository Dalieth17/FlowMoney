package com.flowmoney.presentation.navigation

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.Category
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.flowmoney.R
import com.flowmoney.presentation.ui.categories.CategoriesScreen
import com.flowmoney.presentation.ui.movements.MovementsScreen
import kotlinx.serialization.Serializable
import kotlin.reflect.KClass

/** Destinos con tipos (Navigation 2.8): el compilador valida rutas y argumentos. */
@Serializable
data object MovementsDestination

@Serializable
data object CategoriesDestination

/** Pestañas de la barra inferior. Cada módulo nuevo (Presupuestos, Reportes) añade la suya aquí. */
private enum class TopLevelTab(
    val route: Any,
    val routeClass: KClass<*>,
    @StringRes val label: Int,
    val icon: ImageVector,
) {
    MOVEMENTS(MovementsDestination, MovementsDestination::class, R.string.nav_movements, Icons.AutoMirrored.Rounded.ReceiptLong),
    CATEGORIES(CategoriesDestination, CategoriesDestination::class, R.string.nav_categories, Icons.Rounded.Category),
}

/** Raíz de la interfaz: barra de navegación inferior + grafo de pantallas. */
@Composable
fun FlowMoneyNavHost(
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController(),
) {
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination

    Scaffold(
        modifier = modifier,
        // La barra superior la pone cada pantalla; aquí solo se reserva el alto de la barra inferior.
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            NavigationBar {
                TopLevelTab.entries.forEach { tab ->
                    val selected = currentDestination?.hierarchy?.any { it.hasRoute(tab.routeClass) } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(tab.route) {
                                // Patrón estándar: una sola copia de cada pestaña y su estado se conserva.
                                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = null) },
                        label = { Text(stringResource(tab.label)) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = MovementsDestination,
            // Cada pantalla tiene su propio Scaffold: no debe volver a sumar la barra de navegación.
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
        ) {
            composable<MovementsDestination> { MovementsScreen() }
            composable<CategoriesDestination> { CategoriesScreen() }
        }
    }
}
