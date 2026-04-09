import CreditControlPage from './CreditControlPage';

function EasyBuyGoodClientsPage() {
  return (
    <CreditControlPage
      initialSection="clients"
      clientFilter="good"
      title="EasyBuy Good Clients"
      description="Customers with good repayment behaviour, low risk, and strong EasyBuy history."
    />
  );
}

export default EasyBuyGoodClientsPage;
