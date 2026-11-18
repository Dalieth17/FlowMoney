package com.flowmoney.di

import android.content.Context
import android.content.SharedPreferences
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Qualifier
import javax.inject.Singleton

/** Preferencias simples de la app (moneda elegida). */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class SettingsPreferences

@Module
@InstallIn(SingletonComponent::class)
object PreferencesModule {
    private const val FILE_NAME = "flowmoney_settings"

    @Provides
    @Singleton
    @SettingsPreferences
    fun provideSettingsPreferences(@ApplicationContext context: Context): SharedPreferences =
        context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
}
