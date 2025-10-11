// ავტომობილის ფასების კალკულატორი
export interface VehiclePricingResult {
  totalPrice: number;
  fullDays: number;
  extraHours: number;
  totalHours: number;
  dayPrice: number;
  hourPrice: number;
  depositAmount: number;
}

// წინადებეტის პოლისი ავტომობილებისთვის
const vehicleDepositPolicy = [
  { maxTotal: 500, percent: 0.5 },   // 500₾-მდე - 50%
  { maxTotal: 2000, percent: 0.3 },  // 2000₾-მდე - 30%
  { percent: 0.2 }                   // 2000₾-ზე მეტი - 20%
];

// წინადებეტის გამოთვლა
export function calculateVehicleDeposit(totalPrice: number): number {
  const rule = vehicleDepositPolicy.find(r =>
    r.maxTotal == null ? true : totalPrice <= r.maxTotal
  );
  return Math.ceil(totalPrice * (rule?.percent || 0.2));
}

export function calculateVehiclePrice(
  startDateTime: Date,
  endDateTime: Date,
  pricePerHour: number,
  pricePerDay: number
): VehiclePricingResult {
  // ჯამური საათების გამოთვლა
  const totalMilliseconds = endDateTime.getTime() - startDateTime.getTime();
  const totalHours = Math.ceil(totalMilliseconds / (1000 * 60 * 60));
  
  // სრული დღეები და დარჩენილი საათები
  const fullDays = Math.floor(totalHours / 24);
  const extraHours = totalHours - (fullDays * 24);
  
  // ფასის გამოთვლა
  const dayPrice = fullDays * pricePerDay;
  const hourPrice = extraHours * pricePerHour;
  const totalPrice = dayPrice + hourPrice;
  
  // წინადებეტის გამოთვლა
  const depositAmount = calculateVehicleDeposit(totalPrice);
  
  return {
    totalPrice,
    fullDays,
    extraHours,
    totalHours,
    dayPrice,
    hourPrice,
    depositAmount
  };
}

// ავტომობილის ხელმისაწვდომობის შემოწმება
export function isVehicleAvailable(
  startDateTime: Date,
  endDateTime: Date,
  bookedPeriods: Array<{ start: Date; end: Date }>
): boolean {
  return !bookedPeriods.some(period => {
    // ორი ინტერვალი გადაიკვეთება თუ:
    // ახალი დაწყება < არსებული დასრულება და ახალი დასრულება > არსებული დაწყება
    return startDateTime < period.end && endDateTime > period.start;
  });
}