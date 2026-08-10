const React = require('react');
const { formatCash, formatNumber } = require('../../utils/formatNumber');

function CurrencyDisplay({ value, cash = true }) {
  return <span>{cash ? formatCash(value) : formatNumber(value)}</span>;
}

module.exports = CurrencyDisplay;
