package com.flowmoney.util

import android.app.Activity
import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Imprime un documento HTML con el diálogo de impresión de Android, que incluye "Guardar como
 * PDF" (patrón oficial: developer.android.com/training/printing/html-docs). El WebView nunca se
 * muestra, solo maqueta el documento; va sin JavaScript, sin red y sin acceso a archivos.
 */
class HtmlPrinter(private val activity: Activity) {
    // El WebView debe seguir vivo hasta que la página termina de cargar; después se suelta.
    private var pendingWebView: WebView? = null

    /** @return false si este dispositivo no puede preparar el documento (p. ej. no tiene WebView). */
    fun print(jobName: String, html: String): Boolean = try {
        val webView = WebView(activity).apply {
            settings.javaScriptEnabled = false
            settings.blockNetworkLoads = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClient() {
                // El documento no tiene enlaces; si apareciera uno, no se navega.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true

                override fun onPageFinished(view: WebView, url: String?) = startPrintJob(view, jobName)
            }
        }
        pendingWebView = webView
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
        true
    } catch (error: RuntimeException) {
        // AndroidRuntimeException: el sistema no tiene instalado el paquete de WebView.
        pendingWebView = null
        false
    }

    private fun startPrintJob(webView: WebView, jobName: String) {
        if (pendingWebView !== webView) return // onPageFinished puede llegar más de una vez
        pendingWebView = null
        if (activity.isFinishing || activity.isDestroyed) return
        val printManager = activity.getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return
        try {
            printManager.print(jobName, webView.createPrintDocumentAdapter(jobName), PrintAttributes.Builder().build())
        } catch (error: RuntimeException) {
            // Imprimir es opcional: si el servicio de impresión falla, la app sigue funcionando.
        }
    }
}
