// src\components\LeaseForm.jsx
import React, { useEffect, useState } from 'react';
import { calculateCollateral } from '../utils/calculateCollateral';

const LeaseForm = () => {
  const [form, setForm] = useState({
    tenantName: '',
    creditScore: '',
    monthlyRentUSD: '',
    leaseStart: '',
    leaseEnd: '',
    btcUsdRate: ''
  });

  const [btcRequired, setBtcRequired] = useState(null);

  // Fetch BTC price on mount
  useEffect(() => {
    const fetchBTCPrice = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/lease/btc-price');
        const data = await res.json();
        if (data.price) {
          setForm(prev => ({ ...prev, btcUsdRate: data.price }));
        }
      } catch (err) {
        console.error('❌ Failed to fetch BTC price:', err);
      }
    };
    fetchBTCPrice();
  }, []);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();

    const { monthsRequired, btcRequired } = calculateCollateral(
      Number(form.creditScore),
      Number(form.monthlyRentUSD),
      Number(form.btcUsdRate)
    );
    setBtcRequired(btcRequired);

    const leasePayload = {
      ...form,
      collateralMonths: monthsRequired,
      btcCollateralRequired: btcRequired
    };

    const res = await fetch('http://localhost:5000/api/lease/new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionStorage.getItem('token')}`
      },
      body: JSON.stringify(leasePayload)
    });

    const data = await res.json();
    if (data.success) alert('Lease created!');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="tenantName" placeholder="Tenant Name" onChange={handleChange} />
      <input name="creditScore" type="number" placeholder="Credit Score" onChange={handleChange} />
      <input name="monthlyRentUSD" type="number" placeholder="Monthly Rent (USD)" onChange={handleChange} />
      <input name="leaseStart" type="date" onChange={handleChange} />
      <input name="leaseEnd" type="date" onChange={handleChange} />
      <input
        name="btcUsdRate"
        type="number"
        placeholder="BTC/USD Rate"
        value={form.btcUsdRate}
        onChange={handleChange}
        disabled // prevent user edits
      />
      <button type="submit">Calculate Collateral</button>
      {btcRequired && <p>BTC Required: {btcRequired} BTC</p>}
    </form>
  );
};

export default LeaseForm;
