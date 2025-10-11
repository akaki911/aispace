import { getActivePrice } from '../types/seasonalPricing';

// სეზონური ტარიფების კალკულატორი
export interface PricingResult {
  totalPrice: number;
  pricePerNight: number;
  pricePerGuestPerNight: number;
  nights: number;
  baseRate: number;
  additionalGuestFee: number;
  utilityCost: number;
  season: string;
  isLongStay: boolean;
  depositAmount: number;
  remainingAmount: number;
  isCustomPrice: boolean;
}

// კომუნალური მომსახურების ღირებულება დღეში
const DAILY_UTILITY_COST = 7; // ₾ (ელექტროენერგია 2₾ + გაზი 3₾ + შეშა 2₾)

// წინასწარ გადახდის პოლისი
function calculateAdvancePayment(totalPrice: number): number {
  if (totalPrice < 1500) return totalPrice * 0.5;
  if (totalPrice < 2500) return totalPrice * 0.3;
  if (totalPrice < 4000) return totalPrice * 0.2;
  return totalPrice * 0.15;
}

// წინასწარ გადახდის გამოთვლა
export function calculateDeposit(totalPrice: number): number {
  return Math.ceil(calculateAdvancePayment(totalPrice));
}

export const calculateSeasonalPrice = (
  startDate: Date,
  endDate: Date,
  adults: number,
  children: number,
  useCustomPrice: boolean = false,
  customTotalPrice?: number,
  cottage?: any
): PricingResult => {
  const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (nights <= 0) {
    return {
      totalPrice: 0,
      pricePerNight: 0,
      pricePerGuestPerNight: 0,
      nights: 0,
      baseRate: 0,
      additionalGuestFee: 0,
      utilityCost: 0,
      season: '',
      isLongStay: false,
      depositAmount: 0,
      remainingAmount: 0,
      isCustomPrice: false
    };
  }

  if (useCustomPrice && customTotalPrice) {
    const depositAmount = calculateDeposit(customTotalPrice);
    const pricePerNight = customTotalPrice / nights;
    const pricePerGuestPerNight = adults > 0 ? pricePerNight / adults : 0;

    const remainingAmount = customTotalPrice - depositAmount;

    return {
      totalPrice: customTotalPrice,
      pricePerNight: Math.round(pricePerNight * 100) / 100,
      pricePerGuestPerNight: Math.round(pricePerGuestPerNight * 100) / 100,
      nights,
      baseRate: 0,
      additionalGuestFee: 0,
      utilityCost: 0,
      season: 'ინდივიდუალური ფასი',
      isLongStay: false,
      depositAmount,
      remainingAmount,
      isCustomPrice: true
    };
  }

  // Get base rate using interpolated pricing for the date range
  let baseRate: number;

  // Check if cottage has flexible pricing and use interpolated calculation
  if (cottage?.hasSeasonalPricing && cottage?.priceByMonth) {
    // Use getActivePrice with interpolated pricing for the date range
    baseRate = getActivePrice(cottage, startDate, endDate);

    // Apply long stay discount if applicable
    if (nights >= 21) {
      baseRate = baseRate * 0.9; // 10% discount for long stays
    }
  } else if (cottage?.pricingMode === 'flexible' && cottage?.flexiblePricing) {
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const month = startDate.getMonth();
    const monthKey = monthNames[month];
    const monthPricing = cottage.flexiblePricing[monthKey];

    if (monthPricing) {
      // For flexible pricing, use average of min/max, considering long stay discount
      baseRate = nights >= 21 ? monthPricing.min : (monthPricing.min + monthPricing.max) / 2;
    } else {
      baseRate = cottage.price || 100; // Fallback to base price
    }
  } else {
    // Standard seasonal pricing fallback
    const month = startDate.getMonth();
    const seasonalRates = {
      june: { short: 160, long: 140 },
      july: { short: 185, long: 180 },
      august: { short: 240, long: 200 },
      september: { short: 160, long: 140 }
    };
    switch (month) {
      case 5: // June
        baseRate = nights >= 21 ? seasonalRates.june.long : seasonalRates.june.short;
        break;
      case 6: // July
        baseRate = nights >= 21 ? seasonalRates.july.long : seasonalRates.july.short;
        break;
      case 7: // August
        baseRate = nights >= 21 ? seasonalRates.august.long : seasonalRates.august.short;
        break;
      case 8: // September
        baseRate = nights >= 21 ? seasonalRates.september.long : seasonalRates.september.short;
        break;
      default:
        baseRate = cottage?.price || 100;
    }
  }

  // დამატებითი ზრდასრულების საკომისიო (4-ზე მეტი)
  const extraAdults = Math.max(0, adults - 4);
  const additionalGuestFee = extraAdults * 20;

  // ბაზისური ღამის ფასი (კომუნალურების გარეშე)
  const baseNightlyPrice = baseRate + additionalGuestFee;

  // კომუნალური მომსახურება დღეში
  const utilityCost = DAILY_UTILITY_COST;

  // საბოლოო ღამის ფასი
  const finalNightlyPrice = baseNightlyPrice + utilityCost;

  // ჯამური ფასი
  const totalPrice = finalNightlyPrice * nights;

  // წინასწარ გადახდის გამოთვლა
  const depositAmount = calculateDeposit(totalPrice);
  const remainingAmount = totalPrice - depositAmount;

  // ფასი სტუმარზე ღამეზე
  const pricePerGuestPerNight = adults > 0 ? finalNightlyPrice / adults : 0;

  // Get the month from startDate for season determination
  const month = startDate.getMonth();
  let season = 'other';
  if (month === 5) {
    season = 'ივნისი';
  } else if (month === 6) {
    season = 'ივლისი';
  } else if (month === 7) {
    season = 'აგვისტო';
  } else if (month === 8) {
    season = 'სექტემბერი';
  }

  return {
    totalPrice,
    pricePerNight: finalNightlyPrice,
    pricePerGuestPerNight: Math.round(pricePerGuestPerNight * 100) / 100,
    nights,
    baseRate,
    additionalGuestFee,
    utilityCost,
    season,
    isLongStay: nights >= 21,
    depositAmount,
    remainingAmount,
    isCustomPrice: false
  };
};

// 3 ადამიანზე ოჯახისთვის ფასის გამოთვლა (გამოსატანი ფასისთვის)
export function getDisplayPriceForFamily(): { currentPrice: number; season: string } {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const pricing = calculateSeasonalPrice(today, tomorrow, 3, 0);

  return {
    currentPrice: pricing.pricePerNight,
    season: pricing.season
  };
}

// თვის სახელის მიღება ქართულად
export function getGeorgianMonthName(month: number): string {
  const months = [
    'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
    'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'
  ];
  return months[month - 1] || 'უცნობი თვე';
}

// ფასის დეტალების აღწერა (დასამტკიცებელი ფანჯრისთვის)
export function getPriceBredownText(pricing: PricingResult): string {
  if (pricing.isCustomPrice) {
    return `ინდივიდუალური ფასი: ${pricing.totalPrice}₾ (${pricing.nights} ღამე)`;
  }

  const parts = [];
  const basePriceLabel = pricing.isCustomPrice ? 'ბაზისური ტარიფი' : `სეზონური ფასი (${pricing.season})`;
  parts.push(`${basePriceLabel}: ${pricing.baseRate}₾`);

  if (pricing.additionalGuestFee > 0) {
    const extraAdults = pricing.additionalGuestFee / 20;
    parts.push(`დამატებითი გადასახადი ზრდასრულებზე (${extraAdults}): +${pricing.additionalGuestFee}₾`);
  }

  parts.push(`კომუნალური მომსახურება: +${pricing.utilityCost}₾`);
  parts.push(`ღამეში: ${pricing.pricePerNight}₾`);
  parts.push(`სულ ${pricing.nights} ღამე: ${pricing.totalPrice}₾`);
  parts.push(`ჯავშნის გასააქტიურებელი თანხა: ${pricing.depositAmount}₾`);
  parts.push(`ჩექინის დღეს: ${pricing.remainingAmount}₾`);

  return parts.join('\n');
}