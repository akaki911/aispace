
// Unified pricing types for cottages and hotels
export interface SeasonalPricing {
  seasonPrice: number;        // სეზონური ფასი
  offSeasonPrice: number;     // არასეზონური ფასი
  isSeasonal: boolean;        // რომელი ფასი არის ახლა აქტიური
}

export interface CottageMonthlyPricing {
  june: { min: number; max: number };
  july: { min: number; max: number };
  august: { min: number; max: number };
  september: { min: number; max: number };
}

export interface HotelMonthlyPricing {
  june: number;
  july: number;
  august: number;
  september: number;
}

// Flexible pricing for any month
export interface FlexibleMonthlyPricing {
  [key: string]: { min: number; max: number };
}

export interface FlexibleHotelPricing {
  [key: string]: number;
}

export type PriceByMonth = CottageMonthlyPricing | HotelMonthlyPricing | FlexibleMonthlyPricing | FlexibleHotelPricing;

export interface SeasonalPricingMixin {
  priceByMonth?: PriceByMonth;
  hasSeasonalPricing?: boolean;
  seasonalPricing?: SeasonalPricing;
  seasonPrice?: number;
  offSeasonPrice?: number;
  isSeasonal?: boolean;
}

// Helper functions
export const MONTHS = {
  january: 'იანვარი',
  february: 'თებერვალი',
  march: 'მარტი',
  april: 'აპრილი',
  may: 'მაისი',
  june: 'ივნისი',
  july: 'ივლისი', 
  august: 'აგვისტო',
  september: 'სექტემბერი',
  october: 'ოქტომბერი',
  november: 'ნოემბერი',
  december: 'დეკემბერი'
} as const;

export type MonthKey = keyof typeof MONTHS;

// 🎯 UNIFIED ACTIVE PRICE FUNCTION - ყველაზე მთავარი ფუნქცია
export const getActivePrice = (item: any, startDate?: Date, endDate?: Date): number => {
  // If date range is provided, calculate interpolated average price
  if (startDate && endDate && item.hasSeasonalPricing && item.priceByMonth) {
    return calculateInterpolatedPrice(item, startDate, endDate);
  }

  // Priority 1: Direct seasonal pricing
  if (item.seasonPrice && item.offSeasonPrice) {
    return item.isSeasonal ? item.seasonPrice : item.offSeasonPrice;
  }

  // Priority 2: SeasonalPricing object
  if (item.seasonalPricing) {
    const pricing = item.seasonalPricing;
    if (pricing.seasonPrice && pricing.offSeasonPrice) {
      return pricing.isSeasonal ? pricing.seasonPrice : pricing.offSeasonPrice;
    }
  }

  // Priority 3: Current month from priceByMonth
  if (item.hasSeasonalPricing && item.priceByMonth) {
    const currentMonth = getCurrentMonthKey();
    if (currentMonth) {
      const price = calculateSeasonalPrice(item.priceByMonth, currentMonth, 3);
      if (price > 0) return price;
    }
  }

  // Priority 4: Base price
  return item.pricePerNight || item.price || 100;
};

// 🏷️ GET PRICE LABEL - ფასის ლეიბლი
export const getPriceLabel = (item: any): string => {
  if (item.seasonPrice && item.offSeasonPrice) {
    return item.isSeasonal ? 'სეზონური ფასი' : 'არასეზონური ფასი';
  }
  
  if (item.seasonalPricing) {
    const pricing = item.seasonalPricing;
    if (pricing.seasonPrice && pricing.offSeasonPrice) {
      return pricing.isSeasonal ? 'სეზონური ფასი' : 'არასეზონური ფასი';
    }
  }

  if (item.hasSeasonalPricing && item.priceByMonth) {
    const currentMonth = getCurrentMonthKey();
    if (currentMonth && item.priceByMonth[currentMonth]) {
      return `${MONTHS[currentMonth]} ფასი`;
    }
  }

  return 'ბაზისური ფასი';
};

// 🏷️ FORMAT PRICE - ფორმატირებული ფასი
export const formatPrice = (price: number): string => {
  if (!price || price <= 0) return 'ფასი არ არის განსაზღვრული';
  return `${price.toLocaleString('ka-GE')}\u00A0₾`;
};

export const getDefaultCottagePricing = (): CottageMonthlyPricing => ({
  june: { min: 120, max: 160 },
  july: { min: 150, max: 200 },
  august: { min: 180, max: 250 },
  september: { min: 140, max: 190 }
});

export const getDefaultHotelPricing = (): HotelMonthlyPricing => ({
  june: 150,
  july: 185,
  august: 200,
  september: 160
});

// Utility to check if pricing is for cottage or hotel
export const isCottagePricing = (pricing: PriceByMonth): pricing is CottageMonthlyPricing => {
  return typeof (pricing as CottageMonthlyPricing).june === 'object';
};

export const isHotelPricing = (pricing: PriceByMonth): pricing is HotelMonthlyPricing => {
  return typeof (pricing as HotelMonthlyPricing).june === 'number';
};

export const isFlexibleCottagePricing = (pricing: PriceByMonth): pricing is FlexibleMonthlyPricing => {
  const keys = Object.keys(pricing);
  return keys.length > 0 && typeof (pricing as any)[keys[0]] === 'object' && (pricing as any)[keys[0]].min !== undefined;
};

export const isFlexibleHotelPricing = (pricing: PriceByMonth): pricing is FlexibleHotelPricing => {
  const keys = Object.keys(pricing);
  return keys.length > 0 && typeof (pricing as any)[keys[0]] === 'number';
};

// Get current month key based on current date
export const getCurrentMonthKey = (): MonthKey | null => {
  const month = new Date().getMonth();
  switch (month) {
    case 0: return 'january';
    case 1: return 'february';
    case 2: return 'march';
    case 3: return 'april';
    case 4: return 'may';
    case 5: return 'june';
    case 6: return 'july';
    case 7: return 'august';
    case 8: return 'september';
    case 9: return 'october';
    case 10: return 'november';
    case 11: return 'december';
    default: return null;
  }
};

// Calculate base price for current month
export const calculateSeasonalPrice = (
  pricing: PriceByMonth, 
  currentMonth: string,
  guestCount: number = 2
): number => {
  if (isFlexibleCottagePricing(pricing)) {
    const monthPricing = (pricing as Record<string, { min: number; max: number }>)[currentMonth];
    if (monthPricing) {
      const basePrice = (monthPricing.min + monthPricing.max) / 2;
      return Math.round(basePrice);
    }
  } else if (isFlexibleHotelPricing(pricing)) {
    const basePrice = (pricing as Record<string, number>)[currentMonth];
    if (basePrice) {
      return Math.round(basePrice);
    }
  } else if (isCottagePricing(pricing)) {
    const monthPricing = (pricing as Partial<Record<MonthKey, { min: number; max: number }>>)[currentMonth as MonthKey];
    if (monthPricing) {
      const basePrice = (monthPricing.min + monthPricing.max) / 2;
      return Math.round(basePrice);
    }
  } else {
    const basePrice = (pricing as Partial<Record<MonthKey, number>>)[currentMonth as MonthKey];
    if (basePrice) {
      return Math.round(basePrice);
    }
  }
  return 0;
};

// 📅 INTERPOLATED PRICE CALCULATION - დღეების მიხედვით ფასის ინტერპოლაცია
export const calculateInterpolatedPrice = (item: any, startDate: Date, endDate: Date): number => {
  const priceByMonth = item.priceByMonth;
  if (!priceByMonth) return item.pricePerNight || item.price || 100;

  let totalPrice = 0;
  let numberOfNights = 0;
  
  const currentDate = new Date(startDate);
  
  while (currentDate < endDate) {
    const monthKey = getMonthKeyFromDate(currentDate);
    const monthPricing = priceByMonth[monthKey];
    
    let dailyPrice = item.pricePerNight || item.price || 100; // fallback
    
    if (monthPricing) {
      if (typeof monthPricing === 'object' && monthPricing.min !== undefined && monthPricing.max !== undefined) {
        // Cottage pricing with min/max
        const minPrice = monthPricing.min;
        const maxPrice = monthPricing.max;
        const totalDaysInMonth = getDaysInMonth(currentDate);
        const dayOfMonth = currentDate.getDate();
        const ratio = dayOfMonth / totalDaysInMonth;
        dailyPrice = minPrice + (maxPrice - minPrice) * ratio;
      } else if (typeof monthPricing === 'number') {
        // Hotel pricing with single value
        dailyPrice = monthPricing;
      }
    }
    
    totalPrice += dailyPrice;
    numberOfNights++;
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  const averagePrice = numberOfNights > 0 ? totalPrice / numberOfNights : item.pricePerNight || item.price || 100;
  return Math.round(averagePrice);
};

// 📅 GET MONTH KEY FROM DATE
export const getMonthKeyFromDate = (date: Date): MonthKey => {
  const month = date.getMonth();
  switch (month) {
    case 0: return 'january';
    case 1: return 'february';
    case 2: return 'march';
    case 3: return 'april';
    case 4: return 'may';
    case 5: return 'june';
    case 6: return 'july';
    case 7: return 'august';
    case 8: return 'september';
    case 9: return 'october';
    case 10: return 'november';
    case 11: return 'december';
    default: return 'january';
  }
};

// 📅 GET DAYS IN MONTH
export const getDaysInMonth = (date: Date): number => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

// თვის ქართული სახელები (alternative mapping for compatibility)
export const georgianMonthNames = {
  january: 'იანვარი',
  february: 'თებერვალი', 
  march: 'მარტი',
  april: 'აპრილი',
  may: 'მაისი',
  june: 'ივნისი',
  july: 'ივლისი',
  august: 'აგვისტო',
  september: 'სექტემბერი',
  october: 'ოქტომბერი',
  november: 'ნოემბერი',
  december: 'დეკემბერი'
};
