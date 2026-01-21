// ============================================================================
// Subscription Lifecycle Calculations
// ============================================================================
// All lifecycle calculations - frontend computes, backend stores raw facts
// ============================================================================

// Calculate expected end date based on subscription data
function calculateExpectedEndDate(subscription) {
  // If explicit end date is set, use it
  if (subscription.explicit_end_date) {
    return new Date(subscription.explicit_end_date);
  }

  // Calculate based on total payments
  if (subscription.total_payments) {
    const startDate = new Date(subscription.start_date);
    const intervalsToAdd = subscription.total_payments - 1;

    switch (subscription.billing_cycle) {
      case 'weekly':
        return addDays(startDate, intervalsToAdd * 7);
      case 'monthly':
        return addMonths(startDate, intervalsToAdd);
      case 'quarterly':
        return addMonths(startDate, intervalsToAdd * 3);
      case 'yearly':
        return addYears(startDate, intervalsToAdd);
      default:
        return addMonths(startDate, intervalsToAdd);
    }
  }

  // If no end constraint, return null (ongoing subscription)
  return null;
}

// Calculate total payments count
function calculateTotalPayments(subscription) {
  if (subscription.total_payments) {
    return subscription.total_payments;
  }

  if (subscription.explicit_end_date) {
    const startDate = new Date(subscription.start_date);
    const endDate = new Date(subscription.explicit_end_date);

    switch (subscription.billing_cycle) {
      case 'weekly': {
        const days = daysBetween(startDate, endDate);
        return Math.floor(days / 7) + 1;
      }
      case 'monthly': {
        const months = monthsBetween(startDate, endDate);
        return months + 1;
      }
      case 'quarterly': {
        const months = monthsBetween(startDate, endDate);
        return Math.floor(months / 3) + 1;
      }
      case 'yearly': {
        const years = yearsBetween(startDate, endDate);
        return years + 1;
      }
      default: {
        const months = monthsBetween(startDate, endDate);
        return months + 1;
      }
    }
  }

  return 0;
}

// Calculate next billing date
function calculateNextBillingDate(subscription) {
  const today = startOfDay(new Date());
  const startDate = startOfDay(new Date(subscription.start_date));
  
  if (startDate > today) return startDate;
  
  const expectedEnd = calculateExpectedEndDate(subscription);
  if (expectedEnd && today > expectedEnd) return null;
  
  let nextDate = new Date(startDate);
  
  while (nextDate <= today) {
    switch (subscription.billing_cycle) {
      case 'weekly':
        nextDate = addDays(nextDate, 7);
        break;
      case 'monthly':
        nextDate = addMonths(nextDate, 1);
        break;
      case 'quarterly':
        nextDate = addMonths(nextDate, 3);
        break;
      case 'yearly':
        nextDate = addYears(nextDate, 1);
        break;
      default:
        nextDate = addMonths(nextDate, 1);
    }
  }
  
  if (expectedEnd && nextDate > expectedEnd) return null;
  
  return nextDate;
}

// Calculate payments made (based on current date)
function calculatePaymentsMade(subscription) {
  const today = startOfDay(new Date());
  const startDate = startOfDay(new Date(subscription.start_date));
  const endDate = calculateExpectedEndDate(subscription);

  if (startDate > today) return 0;
  if (endDate && today > endDate) return calculateTotalPayments(subscription);

  switch (subscription.billing_cycle) {
    case 'weekly': {
      const days = daysBetween(startDate, today);
      return Math.floor(days / 7) + 1;
    }
    case 'monthly': {
      const months = monthsBetween(startDate, today);
      return months + 1;
    }
    case 'quarterly': {
      const months = monthsBetween(startDate, today);
      return Math.floor(months / 3) + 1;
    }
    case 'yearly': {
      const years = yearsBetween(startDate, today);
      return years + 1;
    }
    default: {
      const months = monthsBetween(startDate, today);
      return months + 1;
    }
  }
}

// Calculate progress percentage
function calculateProgress(subscription) {
  const totalPayments = calculateTotalPayments(subscription);
  if (totalPayments === 0) return 0;
  
  const paymentsMade = calculatePaymentsMade(subscription);
  return Math.min(100, Math.round((paymentsMade / totalPayments) * 100));
}

// Get subscription status
function getSubscriptionStatus(subscription, daysThreshold = 30) {
  if (subscription.is_active === false) return 'cancelled';
  
  const today = startOfDay(new Date());
  const startDate = startOfDay(new Date(subscription.start_date));
  const endDate = calculateExpectedEndDate(subscription);

  if (startDate > today) return 'upcoming';
  
  if (endDate) {
    const paymentsMade = calculatePaymentsMade(subscription);
    const totalPayments = calculateTotalPayments(subscription);
    
    if (paymentsMade >= totalPayments || today > endDate) return 'completed';
    
    const daysUntilEnd = daysBetween(today, endDate);
    if (daysUntilEnd <= daysThreshold && daysUntilEnd >= 0) return 'ending_soon';
  }

  return 'active';
}

// Enrich subscription with calculated fields
function enrichSubscription(subscription) {
  const totalPayments = calculateTotalPayments(subscription);
  const paymentsMade = calculatePaymentsMade(subscription);
  const paymentsRemaining = Math.max(0, totalPayments - paymentsMade);
  const progressPercent = calculateProgress(subscription);
  const expectedEndDate = calculateExpectedEndDate(subscription);
  const nextBillingDate = calculateNextBillingDate(subscription);
  const status = getSubscriptionStatus(subscription);
  const isCompleted = status === 'completed';

  return {
    ...subscription,
    lifecycle: {
      totalPayments,
      paymentsMade,
      paymentsRemaining,
      progressPercent,
      expectedEndDate: expectedEndDate ? expectedEndDate.toISOString().split('T')[0] : null,
      nextBillingDate: nextBillingDate ? nextBillingDate.toISOString().split('T')[0] : null,
      status,
      isCompleted
    }
  };
}

// Format payment progress
function formatPaymentProgress(enriched) {
  const lifecycle = enriched.lifecycle || enriched;
  return `${lifecycle.paymentsMade} / ${lifecycle.totalPayments} payments`;
}

// Format time remaining
function formatTimeRemaining(enriched) {
  const lifecycle = enriched.lifecycle || enriched;
  if (lifecycle.isCompleted) {
    return 'Completed';
  }
  if (!lifecycle.expectedEndDate) {
    return 'Ongoing';
  }
  return formatDistanceToNow(new Date(lifecycle.expectedEndDate));
}

// ============================================================================
// Date Helper Functions
// ============================================================================

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((date2 - date1) / oneDay);
}

function monthsBetween(date1, date2) {
  const months = (date2.getFullYear() - date1.getFullYear()) * 12;
  return months + date2.getMonth() - date1.getMonth();
}

function yearsBetween(date1, date2) {
  return date2.getFullYear() - date1.getFullYear();
}

function formatDistanceToNow(date) {
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffDays < 0) return 'Ended';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'In 1 day';
  if (diffDays < 30) return `In ${diffDays} days`;
  if (diffMonths === 1) return 'In 1 month';
  if (diffMonths < 12) return `In ${diffMonths} months`;
  if (diffYears === 1) return 'In 1 year';
  return `In ${diffYears} years`;
}
