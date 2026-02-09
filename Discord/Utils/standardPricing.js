function standardizePrice(price) {
  if (price === null || price === undefined || price === "") return "0.00";

  const num = Number(price);
  if (!Number.isFinite(num)) return "0.00";

  if (num > 0 && num < 1) {
    return num.toString();
  }

  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

module.exports = { standardizePrice };
