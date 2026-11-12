package com.flowmoney.util

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper

/** La Activity que hay debajo de un Context (en Compose puede venir envuelto); null si no hay ninguna. */
tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
