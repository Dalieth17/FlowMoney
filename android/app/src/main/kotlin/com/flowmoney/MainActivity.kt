package com.flowmoney

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.flowmoney.presentation.navigation.FlowMoneyNavHost
import com.flowmoney.presentation.theme.FlowMoneyTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            FlowMoneyTheme {
                FlowMoneyNavHost()
            }
        }
    }
}
