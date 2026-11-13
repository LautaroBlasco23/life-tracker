package com.lifetracker.feature.finance

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetracker.core.network.model.MonthlyStats
import com.patrykandpatrick.vico.compose.cartesian.CartesianChartHost
import com.patrykandpatrick.vico.compose.cartesian.axis.rememberAxisGuidelineComponent
import com.patrykandpatrick.vico.compose.cartesian.axis.rememberAxisLabelComponent
import com.patrykandpatrick.vico.compose.cartesian.axis.rememberBottom
import com.patrykandpatrick.vico.compose.cartesian.axis.rememberStart
import com.patrykandpatrick.vico.compose.cartesian.layer.rememberColumnCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.rememberCartesianChart
import com.patrykandpatrick.vico.compose.common.component.rememberLineComponent
import com.patrykandpatrick.vico.compose.common.fill
import com.patrykandpatrick.vico.core.cartesian.axis.HorizontalAxis
import com.patrykandpatrick.vico.core.cartesian.axis.VerticalAxis
import com.patrykandpatrick.vico.core.cartesian.data.CartesianChartModelProducer
import com.patrykandpatrick.vico.core.cartesian.data.CartesianValueFormatter
import com.patrykandpatrick.vico.core.cartesian.data.columnSeries
import com.patrykandpatrick.vico.core.cartesian.layer.ColumnCartesianLayer

/**
 * Monthly-trend bar chart — the `react-native-gifted-charts` BarChart port:
 * per visible month one income bar (green) and one negative outcome bar
 * (red), grid-only styling, no axis lines (RN `xAxisThickness = 0` etc).
 */
internal data class MonthlyTrendPoint(
    val monthIndex: Int,
    val income: Double,
    /** Negative Y value (`-totalOutcome` in RN). */
    val outcome: Double,
)

/** RN `chartData` memo: months up to the current one, last 6 kept. */
internal fun monthlyTrendPoints(stats: List<MonthlyStats>, currentMonth: Int): List<MonthlyTrendPoint> =
    stats
        .mapIndexed { index, monthStats ->
            MonthlyTrendPoint(
                monthIndex = index,
                income = monthStats.totalIncome,
                outcome = -monthStats.totalOutcome,
            )
        }
        .filter { it.monthIndex <= currentMonth }
        .takeLast(6)

@Composable
internal fun MonthlyTrendChart(
    points: List<MonthlyTrendPoint>,
    incomeColor: Color,
    outcomeColor: Color,
    gridColor: Color,
    axisLabelColor: Color,
    modifier: Modifier = Modifier,
) {
    // X values keep the original month index so the formatter can resolve the
    // RN label (`stats.month.slice(0, 3)` — server month names are English).
    val labelFor = remember { MONTH_ABBREVIATIONS }
    val valueFormatter = remember(labelFor) {
        CartesianValueFormatter { _, value, _ ->
            labelFor[value.toInt().coerceIn(0, labelFor.lastIndex)]
        }
    }

    val modelProducer = remember(points) { CartesianChartModelProducer() }
    LaunchedEffect(points) {
        if (points.isEmpty()) return@LaunchedEffect
        val xs = points.map { it.monthIndex }
        modelProducer.runTransaction {
            columnSeries {
                series(x = xs, y = points.map { it.income })
                series(x = xs, y = points.map { it.outcome })
            }
        }
    }

    CartesianChartHost(
        chart = rememberCartesianChart(
            rememberColumnCartesianLayer(
                // Series colors by index: green (income), red (outcome); 12dp
                // columns grouped per month (RN barWidth; grouped is the default).
                columnProvider = ColumnCartesianLayer.ColumnProvider.series(
                    listOf(
                        rememberLineComponent(fill(incomeColor), thickness = 12.dp),
                        rememberLineComponent(fill(outcomeColor), thickness = 12.dp),
                    ),
                ),
            ),
            startAxis = VerticalAxis.rememberStart(
                line = null,
                tick = null,
                label = rememberAxisLabelComponent(color = axisLabelColor, textSize = 10.sp),
                guideline = rememberAxisGuidelineComponent(fill = fill(gridColor)),
            ),
            bottomAxis = HorizontalAxis.rememberBottom(
                line = null,
                tick = null,
                guideline = null,
                label = rememberAxisLabelComponent(color = axisLabelColor, textSize = 10.sp),
                valueFormatter = valueFormatter,
                itemPlacer = remember { HorizontalAxis.ItemPlacer.aligned() },
            ),
        ),
        modelProducer = modelProducer,
        modifier = modifier.fillMaxWidth(),
        // RN `isAnimated = false`.
        animationSpec = null,
        animateIn = false,
    )
}

/** "Jan"…"Dec" — the RN label is `stats.month.slice(0, 3)`. */
private val MONTH_ABBREVIATIONS = listOf(
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)
