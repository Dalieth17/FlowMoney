package com.flowmoney.di

import com.flowmoney.data.repository.BudgetRepositoryImpl
import com.flowmoney.data.repository.CategoryRepositoryImpl
import com.flowmoney.data.repository.TransactionRepositoryImpl
import com.flowmoney.domain.repository.BudgetRepository
import com.flowmoney.domain.repository.CategoryRepository
import com.flowmoney.domain.repository.TransactionRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/** Une cada contrato del dominio con su implementación de datos. */
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    @Singleton
    abstract fun bindCategoryRepository(impl: CategoryRepositoryImpl): CategoryRepository

    @Binds
    @Singleton
    abstract fun bindTransactionRepository(impl: TransactionRepositoryImpl): TransactionRepository

    @Binds
    @Singleton
    abstract fun bindBudgetRepository(impl: BudgetRepositoryImpl): BudgetRepository
}
