from brownie import SwanToken, PredictionMarketNew, AutomatedMarketMaker, accounts, chain


def main():
    # 获取账户
    owner = accounts[0]
    user1 = accounts[1]
    user2 = accounts[2]
    user3 = accounts[3]

    # 1️⃣ 部署 swanToken
    print("\n🚀 Deploying swanToken...")
    betting_token = SwanToken.deploy({'from': owner})
    print(f"✅ swanToken deployed at {betting_token.address}\n")

    # 2️⃣ 部署 AMM 和 PredictionMarket
    print("🚀 Deploying PredictionMarket...")
    amm = AutomatedMarketMaker.deploy({'from': owner})
    prediction_market = PredictionMarketNew.deploy(
        betting_token.address,
        amm.address,
        {'from': owner}
    )

    # 3️⃣ 为用户和owner铸造代币
    mint_amount = 100_000 * 10 ** betting_token.decimals()
    print(f"💰 Minting {mint_amount} BTT to users and owner...")
    betting_token.mint(user1, mint_amount, {'from': owner})
    betting_token.mint(user2, mint_amount, {'from': owner})
    betting_token.mint(user3, mint_amount, {'from': owner})
    betting_token.mint(owner, mint_amount, {'from': owner})
    print(f"✅ owner BTT balance: {betting_token.balanceOf(owner) / 1e18}")
    print(f"✅ user1 BTT balance: {betting_token.balanceOf(user1) / 1e18}")
    print(f"✅ user2 BTT balance: {betting_token.balanceOf(user2) / 1e18}")
    print(f"✅ user3 BTT balance: {betting_token.balanceOf(user3) / 1e18}\n")

    # 4️⃣ 授权 PredictionMarket & AMM 操作代币
    print(f"🔗 Approving PredictionMarket & AMM to spend {mint_amount} BTT from users...")
    betting_token.approve(prediction_market.address, mint_amount, {'from': user1})
    betting_token.approve(prediction_market.address, mint_amount, {'from': user2})
    betting_token.approve(prediction_market.address, mint_amount, {'from': user3})
    betting_token.approve(prediction_market.address, mint_amount, {'from': owner})
    betting_token.approve(amm.address, mint_amount, {'from': user1})
    betting_token.approve(amm.address, mint_amount, {'from': user2})
    betting_token.approve(amm.address, mint_amount, {'from': user3})
    print("✅ Approval successful\n")

    # 5️⃣ 创建市场
    print("📊 Creating a new Prediction Market...")
    temp_owner = betting_token.balanceOf(owner) / 1e18
    print(f"✅ owner BTT balance: {temp_owner}\n")
    tx = prediction_market.createMarket(
        "Will ETH price exceed $5,000?",
        "Yes",
        "No",
        60 * 60 * 24,  # 市场持续 1 天
        {'from': user1}
    )

    print(f"cost of creating!: {betting_token.balanceOf(owner) / 1e18 - temp_owner}\n")

    # 获取 market_id
    market_id = tx.return_value
    print(f"✅ Market Created with ID: {market_id}\n")

    # 获取初始流动性值
    initial_liquidity = prediction_market.initialLiquidity()
    print(f"📊 Initial Liquidity: {initial_liquidity / 1e18}")

    # 查看市场成本和余额
    market_balance = betting_token.balanceOf(prediction_market.address)
    market_cost = prediction_market.getMarketCost(market_id)
    print(f"🏦 Market Cost (LMSR Balance): {market_cost / 1e18} tokens")
    print(f"🏦 Market Balance: {market_balance / 1e18} tokens")

    # 检查 AMM 的价格计算
    market_total_A_before = prediction_market.getMarketInfo(market_id)[6]
    market_total_B_before = prediction_market.getMarketInfo(market_id)[7]
    price_A_before, price_B_before = prediction_market.getMarginalPrices(market_id)
    print(f"💰 Initial AMM Price for 'Yes': {price_A_before / 1e18}")
    print(f"💰 Initial AMM Price for 'No': {price_B_before / 1e18}")
    print(f"🏦 Market Shares Before: A = {market_total_A_before / 1e18}, B = {market_total_B_before / 1e18}\n")

    # 8️⃣ **用户1使用buyByAmount购买Yes选项**
    buy_amount_user1 = 10 * 10 ** betting_token.decimals()  # 用户1投入500个代币购买Yes
    print(f"\n🎟️ User1 buying 'Yes' option with {buy_amount_user1 / 1e18} tokens...")

    user1_balance_before = betting_token.balanceOf(user1)
    user1_shares_before = prediction_market.getSharesBalance(market_id, user1)[0]
    tx_user1 = prediction_market.buyByAmount(market_id, True, buy_amount_user1, {'from': user1})
    user1_balance_after = betting_token.balanceOf(user1)
    user1_shares_after = prediction_market.getSharesBalance(market_id, user1)[0]
    user1_paid = user1_balance_before - user1_balance_after
    user1_shares_bought = user1_shares_after - user1_shares_before
    
    print(f"User1 paid: {user1_paid / 1e18} tokens")
    print(f"User1 received: {user1_shares_bought / 1e18} Yes shares")
    print(f"Price per share: {user1_paid / user1_shares_bought / 1e18 if user1_shares_bought > 0 else 0}")

    # 用户3使用buyByAmount购买Yes选项
    buy_amount_user3 = 40 * 10 ** betting_token.decimals()  # 用户3投入800个代币购买Yes
    print(f"\n🎟️ User3 buying 'Yes' option with {buy_amount_user3 / 1e18} tokens...")

    user3_balance_before = betting_token.balanceOf(user3)
    user3_shares_before = prediction_market.getSharesBalance(market_id, user3)[0]
    tx_user3 = prediction_market.buyByAmount(market_id, True, buy_amount_user3, {'from': user3})
    user3_balance_after = betting_token.balanceOf(user3)
    user3_shares_after = prediction_market.getSharesBalance(market_id, user3)[0]
    user3_paid = user3_balance_before - user3_balance_after
    user3_shares_bought = user3_shares_after - user3_shares_before
    
    print(f"User3 paid: {user3_paid / 1e18} tokens")
    print(f"User3 received: {user3_shares_bought / 1e18} Yes shares")
    print(f"Price per share: {user3_paid / user3_shares_bought / 1e18 if user3_shares_bought > 0 else 0}")

    # 9️⃣ **用户2使用buyByAmount购买No选项**
    buy_amount_user2 = 5 * 10 ** betting_token.decimals()  # 用户2投入600个代币购买No
    print(f"\n🎟️ User2 buying 'No' option with {buy_amount_user2 / 1e18} tokens...")

    user2_balance_before = betting_token.balanceOf(user2)
    user2_shares_before = prediction_market.getSharesBalance(market_id, user2)[1]
    tx_user2 = prediction_market.buyByAmount(market_id, False, buy_amount_user2, {'from': user2})
    user2_balance_after = betting_token.balanceOf(user2)
    user2_shares_after = prediction_market.getSharesBalance(market_id, user2)[1]
    user2_paid = user2_balance_before - user2_balance_after
    user2_shares_bought = user2_shares_after - user2_shares_before
    
    print(f"User2 paid: {user2_paid / 1e18} tokens")
    print(f"User2 received: {user2_shares_bought / 1e18} No shares")
    print(f"Price per share: {user2_paid / user2_shares_bought / 1e18 if user2_shares_bought > 0 else 0}")

    # 获取购买后的总份额和市场余额
    market_total_A_after = prediction_market.getMarketInfo(market_id)[6]
    market_total_B_after = prediction_market.getMarketInfo(market_id)[7]
    print(f"\n🏦 Market Shares After: A = {market_total_A_after / 1e18}, B = {market_total_B_after / 1e18}")

    market_balance_after = betting_token.balanceOf(prediction_market.address)
    print(f"🏦 PredictionMarket Balance After All Purchases: {market_balance_after / 1e18} tokens")

    # 验证用户获得的股份
    user1_shares = prediction_market.getSharesBalance(market_id, user1)
    user2_shares = prediction_market.getSharesBalance(market_id, user2)
    user3_shares = prediction_market.getSharesBalance(market_id, user3)
    print(f"User1 shares: A = {user1_shares[0] / 1e18}, B = {user1_shares[1] / 1e18}")
    print(f"User2 shares: A = {user2_shares[0] / 1e18}, B = {user2_shares[1] / 1e18}")
    print(f"User3 shares: A = {user3_shares[0] / 1e18}, B = {user3_shares[1] / 1e18}")

    # 计算每个用户在获胜池中的份额比例
    total_user_shares_A = user1_shares[0] + user3_shares[0]
    user1_share_ratio = user1_shares[0] / total_user_shares_A if total_user_shares_A > 0 else 0
    user3_share_ratio = user3_shares[0] / total_user_shares_A if total_user_shares_A > 0 else 0
    print(f"\n📊 User1 Share Ratio in winning pool: {user1_share_ratio}")
    print(f"📊 User3 Share Ratio in winning pool: {user3_share_ratio}")

    # 测试价格变化
    price_A_final, price_B_final = prediction_market.getMarginalPrices(market_id)
    print(f"\n📈 Final AMM Price for 'Yes': {price_A_final / 1e18}")
    print(f"📉 Final AMM Price for 'No': {price_B_final / 1e18}")
    # print(f"📊 Price change for 'Yes': {(price_A_final - price_A_before) / 1e18}")
    # print(f"📊 Price change for 'No': {(price_B_final - price_B_before) / 1e18}")

    # 10️⃣ **解析市场 - Yes获胜**
    print("\n📢 Resolving market (Outcome: Yes)...")
    chain.sleep(60 * 60 * 24 + 1)
    chain.mine(2)
    prediction_market.resolveMarket(market_id, 1, {'from': owner})  # 1代表Yes获胜
    print(f"✅ Market Resolved with 'Yes' as the winning outcome\n")
    
    # 获取支付信息
    total_a_payments, total_b_payments = prediction_market.getMarketPayments(market_id)
    print(f"Total Option A Payments: {total_a_payments / 1e18}")
    print(f"Total Option B Payments: {total_b_payments / 1e18}")

    # 获取解析后的份额数据
    market_total_A_resolved = prediction_market.getMarketInfo(market_id)[6]
    market_total_B_resolved = prediction_market.getMarketInfo(market_id)[7]
    print(f"📊 Total shares after resolution: A = {market_total_A_resolved / 1e18}, B = {market_total_B_resolved / 1e18}")
    
    # 计算有效份额
    effective_total_A = market_total_A_resolved
    user1_effective_ratio = user1_shares[0] / effective_total_A if effective_total_A > 0 else 0
    user3_effective_ratio = user3_shares[0] / effective_total_A if effective_total_A > 0 else 0
    print(f"📊 Effective total A shares: {effective_total_A / 1e18}")
    print(f"📊 User1 effective ratio: {user1_effective_ratio}")
    print(f"📊 User3 effective ratio: {user3_effective_ratio}")

    # 计算预期奖励
    losing_pool = total_b_payments
    total_reward_pool = losing_pool + market_cost
    expected_user1_share = user1_effective_ratio * total_reward_pool
    expected_user3_share = user3_effective_ratio * total_reward_pool

    print(f"\n💰 Expected division of reward pool ({total_reward_pool / 1e18} tokens):")
    print(f"User1 should get: {expected_user1_share / 1e18} tokens from reward pool + {user1_paid / 1e18} original payment = {(expected_user1_share + user1_paid) / 1e18} total")
    print(f"User3 should get: {expected_user3_share / 1e18} tokens from reward pool + {user3_paid / 1e18} original payment = {(expected_user3_share + user3_paid) / 1e18} total")

    # 11️⃣ **用户1领取奖金**
    print("\n💰 User1 claiming winnings...")
    user1_balance_before_claim = betting_token.balanceOf(user1)
    prediction_market.claimWinnings(market_id, {'from': user1})
    user1_balance_after_claim = betting_token.balanceOf(user1)
    user1_actual_winnings = user1_balance_after_claim - user1_balance_before_claim
    print(f"User1 actual winnings: {user1_actual_winnings / 1e18} tokens")

    # 12️⃣ **用户3领取奖金**
    print("\n💰 User3 claiming winnings...")
    user3_balance_before_claim = betting_token.balanceOf(user3)
    prediction_market.claimWinnings(market_id, {'from': user3})
    user3_balance_after_claim = betting_token.balanceOf(user3)
    user3_actual_winnings = user3_balance_after_claim - user3_balance_before_claim
    print(f"User3 actual winnings: {user3_actual_winnings / 1e18} tokens")

    # 13️⃣ **用户2尝试领取奖金（应该失败）**
    print("\n💰 User2 attempting to claim winnings (with No shares)...")
    user2_balance_before_claim = betting_token.balanceOf(user2)
    try:
        prediction_market.claimWinnings(market_id, {'from': user2})
        user2_balance_after_claim = betting_token.balanceOf(user2)
        user2_actual_winnings = user2_balance_after_claim - user2_balance_before_claim
        print(f"User2 received: {user2_actual_winnings / 1e18} tokens (unexpected!)")
    except Exception as e:
        print(f"User2 claiming failed as expected: {str(e)}")
        print("✅ Test passed: User with losing shares cannot claim winnings")

    # 14️⃣ **验证股份销毁**
    print("\n🧾 Verifying shares after claiming...")
    user1_shares_after = prediction_market.getSharesBalance(market_id, user1)
    user3_shares_after = prediction_market.getSharesBalance(market_id, user3)
    print(f"User1 shares after claiming: A = {user1_shares_after[0] / 1e18}, B = {user1_shares_after[1] / 1e18}")
    print(f"User3 shares after claiming: A = {user3_shares_after[0] / 1e18}, B = {user3_shares_after[1] / 1e18}")

    # 验证预期与实际
    print("\n🔍 Comparing actual vs expected winnings...")
    expected_user1_total = user1_paid + expected_user1_share
    expected_user3_total = user3_paid + expected_user3_share

    print(f"User1: Expected {expected_user1_total / 1e18}, Actual {user1_actual_winnings / 1e18}, Diff {(user1_actual_winnings - expected_user1_total) / 1e18}")
    print(f"User3: Expected {expected_user3_total / 1e18}, Actual {user3_actual_winnings / 1e18}, Diff {(user3_actual_winnings - expected_user3_total) / 1e18}")

    # 检查奖金总和
    total_winnings = user1_actual_winnings + user3_actual_winnings
    total_expected = losing_pool + user1_paid + user3_paid + market_cost
    print(f"\n💰 Total winnings paid: {total_winnings / 1e18} tokens")
    print(f"💰 Total expected payments: {total_expected / 1e18} tokens")
    print(f"💰 Difference: {(total_winnings - total_expected) / 1e18} tokens")

    market_balance_after = betting_token.balanceOf(prediction_market.address)
    print(f"🏦 PredictionMarket Balance After All: {market_balance_after / 1e18} tokens")

    print("\n🎉 buyByAmount Test Completed! 🚀")