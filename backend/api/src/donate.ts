import { type APIHandler } from './helpers/endpoint'
import { charities } from 'common/charity'
import { APIError } from 'api/helpers/endpoint'
import { runTxn } from 'shared/txn/run-txn'
import { createSupabaseDirectClient } from 'shared/supabase/init'
import { MIN_CASH_DONATION } from 'common/envs/constants'
import { calculateRedeemablePrizeCash } from 'shared/calculate-redeemable-prize-cash'

export const donate: APIHandler<'donate'> = async ({ amount, to }, auth) => {
  const charity = charities.find((c) => c.id === to)
  if (!charity) throw new APIError(404, 'Charity not found')

  const pg = createSupabaseDirectClient()

  await pg.tx(async (tx) => {
    const { cashBalance, redeemable } = await calculateRedeemablePrizeCash(
      tx,
      auth.uid
    )

    if (cashBalance < amount) {
      throw new APIError(403, 'Insufficient prizecash balance')
    }

    if (redeemable < amount) {
      throw new APIError(
        403,
        `Insufficent redeemable prizecash. Only ${redeemable} prizecash can be redeemed.`
      )
    }

    if (amount < MIN_CASH_DONATION) {
      throw new APIError(
        400,
        `Minimum donation is ${MIN_CASH_DONATION} prizecash`
      )
    }

    // const fee = CHARITY_FEE * amount
    // amount -= fee

    // const feeTxn = {
    //   category: 'CHARITY_FEE',
    //   fromType: 'USER',
    //   fromId: auth.uid,
    //   toType: 'BANK',
    //   toId: 'BANK',
    //   amount: fee,
    //   token: 'CASH',
    //   data: {
    //     charityId: charity.id,
    //   },
    // } as const

    // await runTxn(tx, feeTxn)

    const donationTxn = {
      category: 'CHARITY',
      fromType: 'USER',
      fromId: auth.uid,
      toType: 'CHARITY',
      toId: charity.id,
      amount,
      token: 'CASH',
    } as const

    await runTxn(tx, donationTxn)
  })
}
