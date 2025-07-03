// src\utils\calculateCollateral.js
export function calculateCollateral(creditScore, monthlyRentUSD, btcUsdRate) {
  let monthsRequired;

  if (creditScore >= 750) monthsRequired = 1.5;
  else if (creditScore >= 700) monthsRequired = 2;
  else if (creditScore >= 650) monthsRequired = 3;
  else if (creditScore >= 600) monthsRequired = 4;
  else monthsRequired = 6;

  const totalUSD = monthsRequired * monthlyRentUSD;
  const btcRequired = parseFloat((totalUSD / btcUsdRate).toFixed(6));

  return {
    monthsRequired,
    btcRequired
  };
}
