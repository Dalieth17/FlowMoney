package com.flowmoney.presentation.components

import android.provider.Settings
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalContext
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/** Una porción de la dona 3D: ángulos en grados y altura relativa (0..1). */
internal data class DonutSlice(val startDeg: Float, val sweepDeg: Float, val height: Float)

/**
 * Reparte 360° según los valores (en el orden recibido, empezando arriba) y asigna a cada
 * porción una altura proporcional a su peso: la categoría más grande es la más alta.
 */
internal fun donutSlices(values: List<Long>, gapDeg: Float = 2f): List<DonutSlice> {
    val total = values.sum()
    if (total <= 0L) return emptyList()
    val biggest = values.max().toFloat()
    val gap = if (values.size > 1) gapDeg else 0f
    var start = -90f
    return values.map { v ->
        val sweep = (v.toDouble() / total * 360.0).toFloat()
        DonutSlice(startDeg = start + gap / 2f, sweepDeg = (sweep - gap).coerceAtLeast(0.5f), height = 0.25f + 0.75f * v / biggest)
            .also { start += sweep }
    }
}

private const val TILT = 0.5f // achatamiento vertical: cuánto "mira desde arriba" la cámara
private const val INNER = 0.6f // radio del hueco respecto al exterior
private const val MAX_HEIGHT = 0.42f // altura máxima respecto al radio
private const val STEP_DEG = 3f
private const val TURN_MILLIS = 40_000

/**
 * Dona en 3D (proyección oblicua dibujada en Canvas): cada categoría es un arco extruido cuya
 * altura muestra lo que pesa en el mes. Gira despacio salvo que el sistema tenga las
 * animaciones desactivadas. Es decorativa: el detalle accesible está en la leyenda.
 */
@Composable
fun Donut3D(values: List<Long>, colors: List<Color>, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val animate = remember(context) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
    }
    val slices = remember(values) { donutSlices(values) }
    val rotation = if (animate) {
        val transition = rememberInfiniteTransition(label = "donut")
        transition.animateFloat(0f, 360f, infiniteRepeatable(tween(TURN_MILLIS, easing = LinearEasing)), label = "spin").value
    } else {
        0f
    }
    Canvas(modifier) { drawDonut(slices, colors, rotation) }
}

private fun DrawScope.drawDonut(slices: List<DonutSlice>, colors: List<Color>, rotation: Float) {
    if (slices.isEmpty()) return
    val outer = min(size.width / 2f, size.height / (2f * TILT + MAX_HEIGHT * 2f)) * 0.96f
    val inner = outer * INNER
    val maxH = outer * MAX_HEIGHT
    val center = Offset(size.width / 2f, size.height / 2f + maxH / 2f)
    fun point(deg: Float, r: Float, z: Float): Offset {
        val a = (deg + rotation) * PI.toFloat() / 180f
        return Offset(center.x + r * cos(a), center.y + r * sin(a) * TILT - z)
    }
    fun facesViewer(deg: Float) = sin((deg + rotation) * PI.toFloat() / 180f) > 0f
    fun quad(a: Offset, b: Offset, c: Offset, d: Offset, color: Color) {
        drawPath(Path().apply { moveTo(a.x, a.y); lineTo(b.x, b.y); lineTo(c.x, c.y); lineTo(d.x, d.y); close() }, color)
    }
    fun steps(s: DonutSlice): List<Pair<Float, Float>> {
        val n = max(1, (s.sweepDeg / STEP_DEG).toInt())
        return (0 until n).map { i -> (s.startDeg + s.sweepDeg * i / n) to (s.startDeg + s.sweepDeg * (i + 1) / n) }
    }
    val tones = slices.indices.map { colors.getOrElse(it) { Color.Gray } }

    // 1) Paredes interiores visibles (mitad de atrás del hueco).
    slices.forEachIndexed { i, s ->
        val h = s.height * maxH
        val wall = lerp(tones[i], Color.Black, 0.5f)
        steps(s).filter { (a, b) -> !facesViewer((a + b) / 2f) }.forEach { (a, b) ->
            quad(point(a, inner, 0f), point(b, inner, 0f), point(b, inner, h), point(a, inner, h), wall)
        }
    }
    // 2) Paredes exteriores de la mitad de adelante, de atrás hacia adelante.
    slices.indices.sortedBy { sin((slices[it].startDeg + slices[it].sweepDeg / 2f + rotation) * PI.toFloat() / 180f) }.forEach { i ->
        val s = slices[i]
        val h = s.height * maxH
        val wall = lerp(tones[i], Color.Black, 0.3f)
        steps(s).filter { (a, b) -> facesViewer((a + b) / 2f) }.forEach { (a, b) ->
            quad(point(a, outer, 0f), point(b, outer, 0f), point(b, outer, h), point(a, outer, h), wall)
        }
    }
    // 3) Caras superiores.
    slices.forEachIndexed { i, s ->
        val h = s.height * maxH
        val top = Path()
        val pts = steps(s)
        val first = point(pts.first().first, outer, h)
        top.moveTo(first.x, first.y)
        pts.forEach { (_, b) -> point(b, outer, h).let { top.lineTo(it.x, it.y) } }
        pts.reversed().forEach { (_, b) -> point(b, inner, h).let { top.lineTo(it.x, it.y) } }
        point(pts.first().first, inner, h).let { top.lineTo(it.x, it.y) }
        top.close()
        drawPath(top, tones[i])
    }
}
