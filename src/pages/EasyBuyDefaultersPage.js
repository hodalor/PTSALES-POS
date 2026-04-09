import CreditControlPage from './CreditControlPage';

function EasyBuyDefaultersPage() {
  return (
    <CreditControlPage
      initialSection="clients"
      clientFilter="risky"
      title="EasyBuy Defaulters"
      description="Customers with overdue balances, late payments, or risky EasyBuy repayment behaviour."
    />
  );
}

export default EasyBuyDefaultersPage;
