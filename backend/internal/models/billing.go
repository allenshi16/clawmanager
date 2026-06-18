package models

type SubscriptionPlan struct {
	ID             int     `db:"id" json:"id"`
	Name           string  `db:"name" json:"name"`
	Description    string  `db:"description" json:"description"`
	Price          float64 `db:"price" json:"price"`
	Currency       string  `db:"currency" json:"currency"`
	BillingPeriod  string  `db:"billing_period" json:"billing_period"`
	QuotaCPUCores  float64 `db:"quota_cpu_cores" json:"quota_cpu_cores"`
	QuotaMemoryGB  int     `db:"quota_memory_gb" json:"quota_memory_gb"`
	QuotaStorageGB int     `db:"quota_storage_gb" json:"quota_storage_gb"`
	QuotaTokens    int     `db:"quota_tokens" json:"quota_tokens"`
	IsActive       bool    `db:"is_active" json:"is_active"`
	CreatedAt      string  `db:"created_at" json:"created_at"`
	UpdatedAt      string  `db:"updated_at" json:"updated_at"`
}

// UserSubscription represents a user's subscription
type UserSubscription struct {
	ID                   int      `db:"id" json:"id"`
	UserID               int      `db:"user_id" json:"user_id"`
	PlanID               int      `db:"plan_id" json:"plan_id"`
	Status               string   `db:"status" json:"status"`
	CurrentPeriodStart   *string  `db:"current_period_start" json:"current_period_start,omitempty"`
	CurrentPeriodEnd     *string  `db:"current_period_end" json:"current_period_end,omitempty"`
	CancelAtPeriodEnd   bool     `db:"cancel_at_period_end" json:"cancel_at_period_end"`
	StripeSubscriptionID string   `db:"stripe_subscription_id" json:"stripe_subscription_id,omitempty"`
	CreatedAt            string   `db:"created_at" json:"created_at"`
}

// PaymentRecord represents a payment transaction
type PaymentRecord struct {
	ID              int     `db:"id" json:"id"`
	UserID          int     `db:"user_id" json:"user_id"`
	SubscriptionID  int     `db:"subscription_id" json:"subscription_id,omitempty"`
	Amount          float64 `db:"amount" json:"amount"`
	Currency        string  `db:"currency" json:"currency"`
	PaymentMethod   string  `db:"payment_method" json:"payment_method"`
	TransactionID   string  `db:"transaction_id" json:"transaction_id,omitempty"`
	Status          string  `db:"status" json:"status"`
	PaidAt          string  `db:"paid_at" json:"paid_at,omitempty"`
	RawResponse     string  `db:"raw_response" json:"raw_response,omitempty"`
	CreatedAt       string  `db:"created_at" json:"created_at"`
}

// BillingInvoice represents an invoice
type BillingInvoice struct {
	ID           int     `db:"id" json:"id"`
	UserID       int     `db:"user_id" json:"user_id"`
	SubscriptionID int     `db:"subscription_id" json:"subscription_id,omitempty"`
	InvoiceNumber string  `db:"invoice_number" json:"invoice_number,omitempty"`
	Amount        float64 `db:"amount" json:"amount"`
	Currency      string  `db:"currency" json:"currency"`
	Status        string  `db:"status" json:"status"`
	IssuedAt     string  `db:"issued_at" json:"issued_at,omitempty"`
	PaidAt        string  `db:"paid_at" json:"paid_at,omitempty"`
	Items         string  `db:"items" json:"items"` // JSON array
	CreatedAt     string  `db:"created_at" json:"created_at"`
}

// BillingUsageSummary represents usage summary for a user
type BillingUsageSummary struct {
	TotalCost     float64 `json:"total_cost"`
	TotalTokens   int     `json:"total_tokens"`
	TotalRequests int     `json:"total_requests"`
	Currency      string  `json:"currency"`
}
