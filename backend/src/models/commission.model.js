/**
 * Commission model — SaathMein's commission on one completed purchase (PRD §13
 * `commissions`, F17). Part is taken from the buyer's token before the Route transfer
 * (`fromTokenPaise`); the rest is billed on the dealer's monthly GST invoice. Amounts are
 * paise, before GST. Linked to the invoice once billed.
 */
const { Schema, model } = require('mongoose');
const { paiseValidator } = require('./shared.schemas');

const lockedPaise = { type: Number, required: true, validate: paiseValidator, immutable: true };

const commissionSchema = new Schema(
  {
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase', required: true, immutable: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true, immutable: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, immutable: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', immutable: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'City', immutable: true },
    productName: { type: String, trim: true, immutable: true },
    rule: {
      type: { type: String, immutable: true },
      value: { type: Number, immutable: true },
    },
    pricePaise: lockedPaise, // purchase price per unit
    commissionPaise: lockedPaise, // total, before GST
    fromTokenPaise: lockedPaise, // already kept from the token
    invoicedPaise: lockedPaise, // still to be billed
    earnedAt: { type: Date, required: true, immutable: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'CommissionInvoice' },
  },
  { timestamps: true },
);

commissionSchema.index({ purchaseId: 1 }, { unique: true });
commissionSchema.index({ sellerId: 1, earnedAt: 1, invoiceId: 1 });
commissionSchema.index({ earnedAt: -1 });

module.exports = model('Commission', commissionSchema);
