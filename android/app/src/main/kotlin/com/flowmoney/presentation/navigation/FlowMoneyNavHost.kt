package com.flowmoney.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.flowmoney.presentation.ui.categories.CategoriesScreen
import kotlinx.serialization.Serializable

/** Destinos con tipos (Navigation 2.8): el compilador valida rutas y argumentos. */
@Serializable
data object CategoriesDestination

/**
 * Grafo de navegación. Cada módulo nuevo (Movimientos, Presupuestos, Reportes) añade aquí
 * su destino; hoy la app abre en Categorías, el primer módulo terminado.
 */
@Composable
fun FlowMoneyNavHost(
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController(),
) {
    NavHost(navController = navController, startDestination = CategoriesDestination, modifier = modifier) {
        composable<CategoriesDestination> { CategoriesScreen() }
    }
}
