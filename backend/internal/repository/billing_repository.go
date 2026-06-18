package repository;

import (
	"clawreef/internal/models"
	"github.com/upper/db/v4"
)

type BillingRepository interface {
	CreatePlan(plan *models.SubscriptionPlan) (*models.SubscriptionPlan, error)
	GetPlanByID(id int) (*models.SubscriptionPlan, error)
	ListActivePlans() ([]models.SubscriptionPlan, error)

	CreateSubscription(sub *models.UserSubscription) (*models.UserSubscription, error)
	GetSubscriptionByUserID(userID int) (*models.UserSubscription, error)
	UpdateSubscription(sub *models.UserSubscription) error

	CreatePayment(payment *models.PaymentRecord) (*models.PaymentRecord, error)
	UpdatePayment(payment *models.PaymentRecord) error
	ListPaymentsByUserID(userID, limit int) ([]models.PaymentRecord, error)

	CreateInvoice(invoice *models.BillingInvoice) (*models.BillingInvoice, error)
	ListInvoicesByUserID(userID, limit int) ([]models.BillingInvoice, error)
	GetInvoiceByID(id int) (*models.BillingInvoice, error)
}

type billingRepository struct {
	sess db.Session
}

func NewBillingRepository(sess db.Session) BillingRepository {
	return &billingRepository{sess: sess}
}

func (r *billingRepository) CreatePlan(plan *models.SubscriptionPlan) (*models.SubscriptionPlan, error) {
	_, err := r.sess.Collection("subscription_plans").Insert(plan)
	if err != nil {
		return nil, err
	}
	return plan, nil
}

func (r *billingRepository) GetPlanByID(id int) (*models.SubscriptionPlan, error) {
	var plan models.SubscriptionPlan
	err := r.sess.Collection("subscription_plans").Find(db.Cond{"id": id}).One(&plan)
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

func (r *billingRepository) ListActivePlans() ([]models.SubscriptionPlan, error) {
	var plans []models.SubscriptionPlan
	err := r.sess.Collection("subscription_plans").Find(db.Cond{"is_active": true}).All(&plans)
	if err != nil {
		return nil, err
	}
	return plans, nil
}

func (r *billingRepository) CreateSubscription(sub *models.UserSubscription) (*models.UserSubscription, error) {
	_, err := r.sess.Collection("user_subscriptions").Insert(sub)
	if err != nil {
		return nil, err
	}
	return sub, nil
}

func (r *billingRepository) GetSubscriptionByUserID(userID int) (*models.UserSubscription, error) {
	var sub models.UserSubscription
	err := r.sess.Collection("user_subscriptions").Find(db.Cond{"user_id": userID, "status": "active"}).One(&sub)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *billingRepository) UpdateSubscription(sub *models.UserSubscription) error {
	return r.sess.Collection("user_subscriptions").Find(db.Cond{"id": sub.ID}).Update(sub)
}

func (r *billingRepository) CreatePayment(payment *models.PaymentRecord) (*models.PaymentRecord, error) {
	_, err := r.sess.Collection("payment_records").Insert(payment)
	if err != nil {
		return nil, err
	}
	return payment, nil
}

func (r *billingRepository) UpdatePayment(payment *models.PaymentRecord) error {
	return r.sess.Collection("payment_records").Find(db.Cond{"id": payment.ID}).Update(payment)
}

func (r *billingRepository) ListPaymentsByUserID(userID, limit int) ([]models.PaymentRecord, error) {
	var payments []models.PaymentRecord
	q := r.sess.Collection("payment_records").Find(db.Cond{"user_id": userID}).OrderBy("created_at DESC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	err := q.All(&payments)
	if err != nil {
		return nil, err
	}
	return payments, nil
}

func (r *billingRepository) CreateInvoice(invoice *models.BillingInvoice) (*models.BillingInvoice, error) {
	_, err := r.sess.Collection("billing_invoices").Insert(invoice)
	if err != nil {
		return nil, err
	}
	return invoice, nil
}

func (r *billingRepository) ListInvoicesByUserID(userID, limit int) ([]models.BillingInvoice, error) {
	var invoices []models.BillingInvoice
	q := r.sess.Collection("billing_invoices").Find(db.Cond{"user_id": userID}).OrderBy("created_at DESC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	err := q.All(&invoices)
	if err != nil {
		return nil, err
	}
	return invoices, nil
}

func (r *billingRepository) GetInvoiceByID(id int) (*models.BillingInvoice, error) {
	var invoice models.BillingInvoice
	err := r.sess.Collection("billing_invoices").Find(db.Cond{"id": id}).One(&invoice)
	if err != nil {
		return nil, err
	}
	return &invoice, nil
}
