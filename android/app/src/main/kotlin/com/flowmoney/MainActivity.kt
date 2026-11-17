package com.flowmoney

import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.flowmoney.presentation.navigation.FlowMoneyApp
import com.flowmoney.presentation.theme.FlowMoneyTheme
import com.flowmoney.presentation.theme.isDark
import com.flowmoney.presentation.ui.appearance.AppearanceViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            // El tema lo elige la persona (no el modo del sistema): las barras del sistema lo siguen.
            val appearance: AppearanceViewModel = hiltViewModel()
            val state by appearance.uiState.collectAsStateWithLifecycle()
            DisposableEffect(state.theme) {
                val bars = if (state.theme.isDark) {
                    SystemBarStyle.dark(Color.TRANSPARENT)
                } else {
                    SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                }
                enableEdgeToEdge(statusBarStyle = bars, navigationBarStyle = bars)
                onDispose {}
            }
            FlowMoneyTheme(theme = state.theme) {
                FlowMoneyApp(appearanceViewModel = appearance)
            }
        }
    }
}
