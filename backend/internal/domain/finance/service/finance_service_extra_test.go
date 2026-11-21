// finance_service_extra_test.go
//
// Subject:      internal/domain/finance/service.FinanceService — the methods
//
//	not exercised by finance_service_test.go (fixed-transaction
//	listing with payment aggregations, fixed transaction detail
//	with payments, and monthly stats).
//
// Scope:        GetFixedTransactions (month/year aggregated and global),
//
//	GetFixedTransactionWithPayments, GetMonthlyStats 12-month
//	shape with income/outcome/balance.
//
// Out of scope: Movements/summary → finance_service_test.go; HTTP contract →
//
//	finance_controller_test.go.
//
// Infrastructure: MongoDB (test database via .env.test). Collections dropped between tests.
// Data strategy:  Drop all collections before each top-level test function.
// Parallel-safe:  No — shared MongoDB database, global drop between tests.
package service

import (
	"testing"
	"time"

	"life-tracker-backend/internal/domain/finance/dto"
	"life-tracker-backend/internal/domain/finance/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetFixedTransactions(t *testing.T) {
	svc := getTestService(t)
	userID := uint(201)

	fixedRent, err := svc.CreateTransaction(userID, &dto.CreateTransactionRequest{
		Type:             "outcome",
		Frequency:        "fixed",
		Category:         string(model.CategoryHousingUtilities),
		PaymentFrequency: "monthly",
	})
	require.NoError(t, err)

	fixedSalary, err := svc.CreateTransaction(userID, &dto.CreateTransactionRequest{
		Type:             "income",
		Frequency:        "fixed",
		Category:         string(model.CategorySideIncome),
		PaymentFrequency: "monthly",
	})
	require.NoError(t, err)

	_, err = svc.CreateTransaction(userID, &dto.CreateTransactionRequest{
		Type:      "outcome",
		Frequency: "variable",
		Amount:    42.00,
		Category:  string(model.CategoryFoodGroceries),
	})
	require.NoError(t, err)

	_, err = svc.CreateTransaction(202, &dto.CreateTransactionRequest{
		Type:             "outcome",
		Frequency:        "fixed",
		Category:         string(model.CategoryHousingUtilities),
		PaymentFrequency: "monthly",
	})
	require.NoError(t, err)

	// Pay the rent in the current period.
	_, err = svc.CreatePayment(userID, &dto.CreatePaymentRequest{
		TransactionID: fixedRent.ID,
		Amount:        1200.00,
	})
	require.NoError(t, err)

	t.Run("lists only the user's fixed transactions", func(t *testing.T) {
		fixed, err := svc.GetFixedTransactions(userID, nil, nil, time.UTC)
		require.NoError(t, err)
		require.Len(t, fixed, 2)

		byID := map[string]*dto.FixedTransactionResponse{}
		for _, fx := range fixed {
			byID[fx.ID] = fx
		}
		require.Contains(t, byID, fixedRent.ID)
		require.Contains(t, byID, fixedSalary.ID)
		assert.Equal(t, 1200.00, byID[fixedRent.ID].TotalPaid)
		assert.Equal(t, 0.00, byID[fixedSalary.ID].TotalPaid)
		assert.NotNil(t, byID[fixedRent.ID].CurrentPeriodPayment, "paid this period")
		assert.Nil(t, byID[fixedSalary.ID].CurrentPeriodPayment, "unpaid this period")
	})

	t.Run("month/year aggregation path", func(t *testing.T) {
		now := time.Now().UTC()
		month, year := int(now.Month()), now.Year()
		fixed, err := svc.GetFixedTransactions(userID, &month, &year, time.UTC)
		require.NoError(t, err)
		require.Len(t, fixed, 2)
		assert.Equal(t, 1200.00, fixed[0].TotalPaid+fixed[1].TotalPaid)
	})

	t.Run("no fixed transactions returns empty list", func(t *testing.T) {
		fixed, err := svc.GetFixedTransactions(999, nil, nil, time.UTC)
		require.NoError(t, err)
		assert.Empty(t, fixed)
	})
}

func TestGetFixedTransactionWithPayments(t *testing.T) {
	svc := getTestService(t)
	userID := uint(301)

	fixedTx, err := svc.CreateTransaction(userID, &dto.CreateTransactionRequest{
		Type:             "outcome",
		Frequency:        "fixed",
		Category:         string(model.CategoryHousingUtilities),
		PaymentFrequency: "monthly",
	})
	require.NoError(t, err)

	t.Run("aggregates payments for the transaction", func(t *testing.T) {
		_, err := svc.CreatePayment(userID, &dto.CreatePaymentRequest{
			TransactionID: fixedTx.ID,
			Amount:        300.00,
		})
		require.NoError(t, err)

		detail, err := svc.GetFixedTransactionWithPayments(userID, fixedTx.ID)
		require.NoError(t, err)
		assert.Equal(t, fixedTx.ID, detail.ID)
		assert.Equal(t, 300.00, detail.TotalPaid)
		require.Len(t, detail.Payments, 1)
		assert.Equal(t, 300.00, detail.Payments[0].Amount)
	})

	t.Run("without payments", func(t *testing.T) {
		untouched, err := svc.CreateTransaction(userID, &dto.CreateTransactionRequest{
			Type:             "outcome",
			Frequency:        "fixed",
			Category:         string(model.CategoryHousingUtilities),
			PaymentFrequency: "monthly",
		})
		require.NoError(t, err)

		detail, err := svc.GetFixedTransactionWithPayments(userID, untouched.ID)
		require.NoError(t, err)
		assert.Equal(t, 0.00, detail.TotalPaid)
		assert.Empty(t, detail.Payments)
	})

	t.Run("variable transaction rejected", func(t *testing.T) {
		variableTx, err := svc.CreateTransaction(userID, &dto.CreateTransactionRequest{
			Type:      "outcome",
			Frequency: "variable",
			Amount:    10.00,
			Category:  string(model.CategoryFoodGroceries),
		})
		require.NoError(t, err)

		_, err = svc.GetFixedTransactionWithPayments(userID, variableTx.ID)
		assert.Error(t, err)
	})

	t.Run("foreign transaction rejected", func(t *testing.T) {
		_, err := svc.CreateTransaction(302, &dto.CreateTransactionRequest{
			Type:             "outcome",
			Frequency:        "fixed",
			Category:         string(model.CategoryHousingUtilities),
			PaymentFrequency: "monthly",
		})
		require.NoError(t, err)

		// A transaction owned by another user must not resolve.
		foreign, err := svc.GetFixedTransactions(302, nil, nil, time.UTC)
		require.NoError(t, err)
		require.Len(t, foreign, 1)

		_, err = svc.GetFixedTransactionWithPayments(userID, foreign[0].ID)
		assert.Error(t, err)
	})
}

func TestGetMonthlyStats(t *testing.T) {
	svc := getTestService(t)
	userID := uint(401)
	year := time.Now().UTC().Year()

	_, err := svc.CreateTransaction(userID, &dto.CreateTransactionRequest{
		Type:      "income",
		Frequency: "variable",
		Amount:    500.00,
		Category:  string(model.CategorySideIncome),
	})
	require.NoError(t, err)

	_, err = svc.CreateTransaction(userID, &dto.CreateTransactionRequest{
		Type:      "outcome",
		Frequency: "variable",
		Amount:    200.00,
		Category:  string(model.CategoryFoodGroceries),
	})
	require.NoError(t, err)

	t.Run("returns twelve months for the year", func(t *testing.T) {
		stats, err := svc.GetMonthlyStats(userID, year, time.UTC)
		require.NoError(t, err)
		require.Len(t, stats, 12)

		byMonth := map[string]*dto.MonthlyStatsResponse{}
		for _, s := range stats {
			byMonth[s.Month] = s
		}
		current := byMonth[time.Now().UTC().Month().String()]
		require.NotNil(t, current)
		assert.Equal(t, year, current.Year)
		assert.Equal(t, 500.00, current.TotalIncome)
		assert.Equal(t, 200.00, current.TotalOutcome)
		assert.Equal(t, 300.00, current.Balance)
		assert.Equal(t, int64(2), current.TransactionCount)
	})

	t.Run("other years and users are empty", func(t *testing.T) {
		stats, err := svc.GetMonthlyStats(userID, year-1, time.UTC)
		require.NoError(t, err)
		require.Len(t, stats, 12)
		for _, s := range stats {
			assert.Equal(t, 0.00, s.Balance)
		}

		stats, err = svc.GetMonthlyStats(402, year, time.UTC)
		require.NoError(t, err)
		for _, s := range stats {
			assert.Equal(t, 0.00, s.Balance)
		}
	})
}
