package com.flowmoney.di

import android.content.Context
import androidx.room.Room
import com.flowmoney.data.local.AppDatabase
import com.flowmoney.data.local.SeedDatabaseCallback
import com.flowmoney.data.local.dao.CategoryDao
import com.flowmoney.data.local.dao.TransactionDao
import com.flowmoney.data.local.migrations.ALL_MIGRATIONS
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, AppDatabase.NAME)
            .addCallback(SeedDatabaseCallback())
            // Sin fallbackToDestructiveMigration: un cambio de esquema sin migración debe fallar
            // en desarrollo, no borrar los datos del usuario en producción.
            .addMigrations(*ALL_MIGRATIONS)
            .build()

    @Provides
    fun provideCategoryDao(database: AppDatabase): CategoryDao = database.categoryDao()

    @Provides
    fun provideTransactionDao(database: AppDatabase): TransactionDao = database.transactionDao()
}
