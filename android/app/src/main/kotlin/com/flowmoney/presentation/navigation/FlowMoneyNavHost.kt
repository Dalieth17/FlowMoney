package com.flowmoney.presentation.navigation

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ReceiptLong
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.BarChart
import androidx.compose.material.icons.rounded.Category
import androidx.compose.material.icons.rounded.DataUsage
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.flowmoney.R
import com.flowmoney.presentation.format.LocalMoneyFormatter
import com.flowmoney.presentation.format.MoneyFormatter
import com.flowmoney.presentation.ui.advisor.AdvisorScreen
import com.flowmoney.presentation.ui.budgets.BudgetsScreen
import com.flowmoney.presentation.ui.categories.CategoriesScreen
import com.flowmoney.presentation.ui.currency.CurrencyChoiceScreen
import com.flowmoney.presentation.ui.currency.CurrencyDialog
import com.flowmoney.presentation.ui.currency.CurrencyUiState
import com.flowmoney.presentation.ui.currency.CurrencyViewModel
import com.flowmoney.presentation.ui.movements.MovementsScreen
import com.flowmoney.presentation.ui.reports.ReportsScreen
import kotlin.reflect.KClass
import kotlinx.serialization.Serializable

/** Destinos con tipos (Navigation 2.8): el compilador valida rutas y argumentos. */
@Serializable
data object MovementsDestination

@Serializable
data object BudgetsDestination

@Serializable
data object ReportsDestination

@Serializable
data object AdvisorDestination

@Serializable
data object CategoriesDestination

/** Pestañas de la barra inferior, en el orden en que se muestran. */
private enum class TopLevelTab(
    val route: Any,
    val routeClass: KClass<*>,
    @StringRes val label: Int,
    val icon: ImageVector,
) {
    MOVEMENTS(MovementsDestination, MovementsDestination::class, R.string.nav_movements, Icons.AutoMirrored.Rounded.ReceiptLong),
    BUDGETS(BudgetsDestination, BudgetsDestination::class, R.string.nav_budgets, Icons.Rounded.DataUsage),
    REPORTS(ReportsDestination, ReportsDestination::class, R.string.nav_reports, Icons.Rounded.BarChart),
    ADVISOR(AdvisorDestination, AdvisorDestination::class, R.string.nav_advisor, Icons.Rounded.AutoAwesome),
    CATEGORIES(CategoriesDestination, CategoriesDestination::class, R.string.nav_categories, Icons.Rounded.Category),
}

/**
 * Raíz de la interfaz. En el primer uso pide la moneda; después provee su formato a toda la app
 * ([LocalMoneyFormatter]) y muestra la navegación.
 */
@Composable
fun FlowMoneyApp(modifier: Modifier = Modifier, currencyViewModel: CurrencyViewModel = hiltViewModel()) {
    val currencyState by currencyViewModel.uiState.collectAsStateWithLifecycle()
    var showCurrencyDialog by rememberSaveable { mutableStateOf(false) }

    when (val state = currencyState) {
        CurrencyUiState.Loading -> Unit
        CurrencyUiState.NeedsChoice -> CurrencyChoiceScreen(onChoose = currencyViewModel::choose, modifier = modifier)
        is CurrencyUiState.Ready -> {
            CompositionLocalProvider(LocalMoneyFormatter provides MoneyFormatter.of(state.currency)) {
                FlowMoneyNavHost(modifier = modifier, onCurrencyClick = { showCurrencyDialog = true })
            }
            if (showCurrencyDialog) {
                CurrencyDialog(
                    current = state.currency,
                    onChoose = currencyViewModel::choose,
                    onDismiss = { showCurrencyDialog = false },
                )
            }
        }
    }
}

/** Barra de navegación inferior + grafo de pantallas. */
@Composable
fun FlowMoneyNavHost(
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController(),
    onCurrencyClick: () -> Unit = {},
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
            composable<MovementsDestination> { MovementsScreen(onCurrencyClick = onCurrencyClick) }
            composable<BudgetsDestination> { BudgetsScreen() }
            composable<ReportsDestination> { ReportsScreen() }
            composable<AdvisorDestination> { AdvisorScreen() }
            composable<CategoriesDestination> { CategoriesScreen() }
        }
    }
}
