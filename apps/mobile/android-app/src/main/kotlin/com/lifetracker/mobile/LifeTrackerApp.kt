package com.lifetracker.mobile

import android.app.Application
import com.lifetracker.core.i18n.I18n

class LifeTrackerApp : Application() {
    override fun onCreate() {
        super.onCreate()
        I18n.init(this)
    }
}
