import React, { useState } from 'react';

function LoanForm() {
  const [amount, setAmount] = useState('');
  const [btc, setBtc] = useState('');
  const [term, setTerm] = useState('12');

  const handleLoanSubmit = (e) => {
    e.preventDefault();
    alert(`Loan Requested: $${amount} with ${btc} BTC for ${term} months`);
  };

  return (
    <div className="loan-box">
      <h2>Bitcoin-Backed Loan</h2>
      <form onSubmit={handleLoanSubmit}>
        <div className="input-group">
          <label>Loan Amount (USD)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label>Collateral (BTC)</label>
          <input
            type="number"
            value={btc}
            onChange={(e) => setBtc(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label>Loan Term (months)</label>
          <select value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="36">36</option>
          </select>
        </div>
        <button type="submit">Apply for Loan</button>
      </form>
    </div>
  );
}

export default LoanForm;
