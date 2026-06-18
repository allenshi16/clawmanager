package services

import (
	"time"

	"clawreef/internal/models"
	"clawreef/internal/repository"
)

type BillingService interface {
	ListPlans() ([]models.SubscriptionPlan, error)
	GetPlanByID(planID int) (*models.SubscriptionPlan, error)
	GetUserSubscription(userID int) (*models.UserSubscription, error)
	CreateSubscription(userID, planID int) (*models.UserSubscription, error)
	CancelSubscription(userID int) error
	CreatePayment(payment *models.PaymentRecord) (*models.PaymentRecord, error)
	ListPayments(userID, limit int) ([]models.PaymentRecord, error)
	CreateInvoice(invoice *models.BillingInvoice) (*models.BillingInvoice, error)
	ListInvoices(userID, limit int) ([]models.BillingInvoice, error)
	GetUsageSummary(userID int) (*models.BillingUsageSummary, error)
}

type billingService struct {
	repo      repository.BillingRepository
	costRepo repository.CostRecordRepository
}

func NewBillingService(repo repository.BillingRepository, costRepo repository.CostRecordRepository) BillingService {
	return &billingService{repo: repo, costRepo: costRepo}
}

func (s *billingService) ListPlans() ([]models.SubscriptionPlan, error) {
	return s.repo.ListActivePlans()
}

func (s *billingService) GetPlanByID(planID int) (*models.SubscriptionPlan, error) {
	return s.repo.GetPlanByID(planID)
}

func (s *billingService) GetUserSubscription(userID int) (*models.UserSubscription, error) {
	return s.repo.GetSubscriptionByUserID(userID)
}

func (s *billingService) CreateSubscription(userID, planID int) (*models.UserSubscription, error) {
	_, err := s.repo.GetPlanByID(planID)
	if err != nil {
		return nil, err
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	sub := &models.UserSubscription{
		UserID:             userID,
		PlanID:             planID,
		Status:              "active",
		CreatedAt:           now,
	}

	return s.repo.CreateSubscription(sub)
}

func (s *billingService) CancelSubscription(userID int) error {
	sub, err := s.repo.GetSubscriptionByUserID(userID)
	if err != nil {
		return err
	}
	sub.Status = "cancelled"
	return s.repo.UpdateSubscription(sub)
}

func (s *billingService) CreatePayment(payment *models.PaymentRecord) (*models.PaymentRecord, error) {
	return s.repo.CreatePayment(payment)
}

func (s *billingService) ListPayments(userID, limit int) ([]models.PaymentRecord, error) {
	return s.repo.ListPaymentsByUserID(userID, limit)
}

func (s *billingService) CreateInvoice(invoice *models.BillingInvoice) (*models.BillingInvoice, error) {
	return s.repo.CreateInvoice(invoice)
}

func (s *billingService) ListInvoices(userID, limit int) ([]models.BillingInvoice, error) {
	return s.repo.ListInvoicesByUserID(userID, limit)
}

func (s *billingService) GetUsageSummary(userID int) (*models.BillingUsageSummary, error) {
	return nil, nil
}
