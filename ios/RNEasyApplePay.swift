import Foundation
import PassKit
import React

@objc(RNEasyApplePay)
class RNEasyApplePay: RCTEventEmitter, PKPaymentAuthorizationViewControllerDelegate {

    private var paymentResolve: RCTPromiseResolveBlock?
    private var paymentReject: RCTPromiseRejectBlock?
    private var completionHandler: ((PKPaymentAuthorizationResult) -> Void)?
    private var shippingContactCompletion: ((PKPaymentRequestShippingContactUpdate) -> Void)?
    private var shippingMethodCompletion: ((PKPaymentRequestShippingMethodUpdate) -> Void)?
    private weak var presentedController: PKPaymentAuthorizationViewController?
    private var hasListeners = false

    // MARK: - RCTEventEmitter

    override func supportedEvents() -> [String]! {
        return ["onShippingContactChange", "onShippingMethodChange"]
    }

    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override func startObserving() {
        hasListeners = true
    }

    override func stopObserving() {
        hasListeners = false
    }

    // MARK: - Availability Checks

    @objc func canMakePayments(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(PKPaymentAuthorizationViewController.canMakePayments())
    }

    @objc func canMakePaymentsWithNetworks(
        _ networks: [String],
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let mapped = networks.compactMap { mapNetwork($0) }
        resolve(PKPaymentAuthorizationViewController.canMakePayments(usingNetworks: mapped))
    }

    // MARK: - Request Payment

    @objc func requestPayment(
        _ params: NSDictionary,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard self.paymentResolve == nil, self.paymentReject == nil else {
            reject("ALREADY_PRESENTING", "An Apple Pay sheet is already presented. Dismiss it before requesting a new payment.", nil)
            return
        }

        guard let merchantId = params["merchantIdentifier"] as? String, !merchantId.isEmpty,
              let countryCode = params["countryCode"] as? String, !countryCode.isEmpty,
              let currencyCode = params["currencyCode"] as? String, !currencyCode.isEmpty,
              let items = params["items"] as? [[String: Any]], !items.isEmpty
        else {
            reject("INVALID_PARAMS", "Missing or empty required payment parameters: merchantIdentifier, countryCode, currencyCode, items.", nil)
            return
        }

        let request = PKPaymentRequest()
        request.merchantIdentifier = merchantId
        request.countryCode = countryCode
        request.currencyCode = currencyCode
        request.merchantCapabilities = .capability3DS

        if let networks = params["supportedNetworks"] as? [String] {
            request.supportedNetworks = networks.compactMap { mapNetwork($0) }
        }

        if let capabilities = params["merchantCapabilities"] as? [String] {
            var caps: PKMerchantCapability = []
            for cap in capabilities {
                switch cap {
                case "3DS":    caps.insert(.capability3DS)
                case "EMV":    caps.insert(.capabilityEMV)
                case "credit":
                    if #available(iOS 14.5, *) { caps.insert(.capabilityCredit) }
                case "debit":
                    if #available(iOS 14.5, *) { caps.insert(.capabilityDebit) }
                default: break
                }
            }
            request.merchantCapabilities = caps
        }

        let summaryItems = items.compactMap { item -> PKPaymentSummaryItem? in
            guard let label = item["label"] as? String,
                  let amount = item["amount"] as? String
            else { return nil }
            let decimal = NSDecimalNumber(string: amount)
            guard decimal != .notANumber else { return nil }
            let type: PKPaymentSummaryItemType = (item["type"] as? String) == "pending" ? .pending : .final
            return PKPaymentSummaryItem(label: label, amount: decimal, type: type)
        }

        guard summaryItems.count == items.count else {
            reject("INVALID_PARAMS", "One or more payment items had invalid label or amount.", nil)
            return
        }

        request.paymentSummaryItems = summaryItems

        if let methods = params["shippingMethods"] as? [[String: Any]] {
            request.shippingMethods = methods.compactMap { buildShippingMethod($0) }
        }

        if let fields = params["requiredShippingContactFields"] as? [String] {
            request.requiredShippingContactFields = Set(fields.compactMap { mapContactField($0) })
        }

        if let fields = params["requiredBillingContactFields"] as? [String] {
            request.requiredBillingContactFields = Set(fields.compactMap { mapContactField($0) })
        }

        self.paymentResolve = resolve
        self.paymentReject = reject

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard let vc = PKPaymentAuthorizationViewController(paymentRequest: request) else {
                self.failPayment("UNABLE_TO_PRESENT", "Cannot create Apple Pay controller. Check your merchant ID and entitlements.")
                return
            }
            vc.delegate = self
            self.presentedController = vc

            guard let topVC = self.topViewController() else {
                self.failPayment("NO_VIEW_CONTROLLER", "No root view controller found to present Apple Pay sheet.")
                return
            }

            topVC.present(vc, animated: true, completion: nil)
        }
    }

    // MARK: - Complete / Dismiss

    @objc func completePayment(
        _ success: Bool,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard let handler = self.completionHandler else {
                reject("NO_PENDING_PAYMENT", "completePayment called without an active payment.", nil)
                return
            }
            let status: PKPaymentAuthorizationStatus = success ? .success : .failure
            handler(PKPaymentAuthorizationResult(status: status, errors: nil))
            self.completionHandler = nil
            resolve(nil)
        }
    }

    @objc func dismissPayment(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let controller = self.presentedController
            self.cancelInFlightPayment()

            if let controller = controller {
                controller.dismiss(animated: true) {
                    self.presentedController = nil
                    resolve(nil)
                }
            } else {
                resolve(nil)
            }
        }
    }

    // MARK: - Update Shipping Methods (called from JS in response to onShippingContactChange)

    @objc func updateShippingMethods(
        _ items: [[String: Any]],
        shippingMethods methods: [[String: Any]],
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard let summary = self.buildSummaryItems(items) else {
                reject("INVALID_PARAMS", "Invalid items passed to updateShippingMethods.", nil)
                return
            }
            let shipping = methods.compactMap { self.buildShippingMethod($0) }

            if let completion = self.shippingContactCompletion {
                let update = PKPaymentRequestShippingContactUpdate(
                    errors: nil,
                    paymentSummaryItems: summary,
                    shippingMethods: shipping
                )
                completion(update)
                self.shippingContactCompletion = nil
                resolve(nil)
                return
            }

            if let completion = self.shippingMethodCompletion {
                let update = PKPaymentRequestShippingMethodUpdate(paymentSummaryItems: summary)
                completion(update)
                self.shippingMethodCompletion = nil
                resolve(nil)
                return
            }

            reject("NO_PENDING_UPDATE", "updateShippingMethods called without a pending shipping change.", nil)
        }
    }

    @objc func updateShippingMethodsWithError(
        _ errorMessage: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let error = NSError(
                domain: PKPaymentErrorDomain,
                code: PKPaymentError.shippingContactInvalidError.rawValue,
                userInfo: [NSLocalizedDescriptionKey: errorMessage]
            )

            if let completion = self.shippingContactCompletion {
                let update = PKPaymentRequestShippingContactUpdate(
                    errors: [error],
                    paymentSummaryItems: [],
                    shippingMethods: []
                )
                completion(update)
                self.shippingContactCompletion = nil
                resolve(nil)
                return
            }

            reject("NO_PENDING_UPDATE", "updateShippingMethodsWithError called without a pending shipping change.", nil)
        }
    }

    // MARK: - PKPaymentAuthorizationViewControllerDelegate

    func paymentAuthorizationViewController(
        _ controller: PKPaymentAuthorizationViewController,
        didAuthorizePayment payment: PKPayment,
        handler completion: @escaping (PKPaymentAuthorizationResult) -> Void
    ) {
        self.completionHandler = completion

        let token = payment.token
        var result: [String: Any] = [
            "token": token.paymentData.base64EncodedString(),
            "transactionIdentifier": token.transactionIdentifier,
            "paymentMethod": [
                "network": token.paymentMethod.network?.rawValue ?? "",
                "type": stringForPaymentMethodType(token.paymentMethod.type),
                "displayName": token.paymentMethod.displayName ?? "",
            ],
        ]

        if let paymentDataJSON = try? JSONSerialization.jsonObject(with: token.paymentData) as? [String: Any] {
            result["paymentData"] = paymentDataJSON
        }

        if let billing = payment.billingContact {
            result["billingContact"] = serializeContact(billing)
        }

        if let shipping = payment.shippingContact {
            result["shippingContact"] = serializeContact(shipping)
        }

        if let method = payment.shippingMethod {
            result["shippingMethod"] = [
                "identifier": method.identifier ?? "",
                "label": method.label,
                "detail": method.detail ?? "",
                "amount": method.amount.stringValue,
            ]
        }

        paymentResolve?(result)
        paymentResolve = nil
        paymentReject = nil
    }

    func paymentAuthorizationViewControllerDidFinish(
        _ controller: PKPaymentAuthorizationViewController
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            controller.dismiss(animated: true) {
                self.cancelInFlightPayment()
                self.presentedController = nil
            }
        }
    }

    func paymentAuthorizationViewController(
        _ controller: PKPaymentAuthorizationViewController,
        didSelectShippingContact contact: PKContact,
        handler completion: @escaping (PKPaymentRequestShippingContactUpdate) -> Void
    ) {
        // If JS has no subscriber for the event, immediately resolve with empty update so the sheet doesn't hang.
        guard hasListeners else {
            completion(PKPaymentRequestShippingContactUpdate(
                errors: nil,
                paymentSummaryItems: controller.paymentRequest.paymentSummaryItems,
                shippingMethods: controller.paymentRequest.shippingMethods ?? []
            ))
            return
        }

        self.shippingContactCompletion = completion
        sendEvent(withName: "onShippingContactChange", body: serializeContact(contact))
    }

    func paymentAuthorizationViewController(
        _ controller: PKPaymentAuthorizationViewController,
        didSelectShippingMethod shippingMethod: PKShippingMethod,
        handler completion: @escaping (PKPaymentRequestShippingMethodUpdate) -> Void
    ) {
        guard hasListeners else {
            completion(PKPaymentRequestShippingMethodUpdate(paymentSummaryItems: controller.paymentRequest.paymentSummaryItems))
            return
        }

        self.shippingMethodCompletion = completion
        sendEvent(withName: "onShippingMethodChange", body: [
            "identifier": shippingMethod.identifier ?? "",
            "label": shippingMethod.label,
            "detail": shippingMethod.detail ?? "",
            "amount": shippingMethod.amount.stringValue,
        ])
    }

    // MARK: - Helpers

    private func cancelInFlightPayment() {
        if let reject = paymentReject {
            reject("USER_CANCELLED", "User cancelled Apple Pay", nil)
        }
        paymentResolve = nil
        paymentReject = nil
        completionHandler = nil
        shippingContactCompletion = nil
        shippingMethodCompletion = nil
    }

    private func failPayment(_ code: String, _ message: String) {
        if let reject = paymentReject {
            reject(code, message, nil)
        }
        paymentResolve = nil
        paymentReject = nil
        presentedController = nil
    }

    private func topViewController() -> UIViewController? {
        let keyWindow: UIWindow?
        if #available(iOS 13.0, *) {
            keyWindow = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first(where: { $0.activationState == .foregroundActive })?
                .windows
                .first(where: { $0.isKeyWindow }) ??
                UIApplication.shared.connectedScenes
                    .compactMap { $0 as? UIWindowScene }
                    .flatMap { $0.windows }
                    .first(where: { $0.isKeyWindow })
        } else {
            keyWindow = nil
        }

        var top = keyWindow?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }

    private func buildShippingMethod(_ m: [String: Any]) -> PKShippingMethod? {
        guard let id = m["identifier"] as? String,
              let label = m["label"] as? String,
              let amount = m["amount"] as? String
        else { return nil }
        let decimal = NSDecimalNumber(string: amount)
        guard decimal != .notANumber else { return nil }
        let method = PKShippingMethod(label: label, amount: decimal)
        method.identifier = id
        method.detail = (m["detail"] as? String) ?? ""
        return method
    }

    private func buildSummaryItems(_ items: [[String: Any]]) -> [PKPaymentSummaryItem]? {
        var result: [PKPaymentSummaryItem] = []
        for item in items {
            guard let label = item["label"] as? String,
                  let amount = item["amount"] as? String
            else { return nil }
            let decimal = NSDecimalNumber(string: amount)
            guard decimal != .notANumber else { return nil }
            let type: PKPaymentSummaryItemType = (item["type"] as? String) == "pending" ? .pending : .final
            result.append(PKPaymentSummaryItem(label: label, amount: decimal, type: type))
        }
        return result
    }

    private func stringForPaymentMethodType(_ type: PKPaymentMethodType) -> String {
        switch type {
        case .debit:    return "debit"
        case .credit:   return "credit"
        case .prepaid:  return "prepaid"
        case .store:    return "store"
        case .eMoney:   return "eMoney"
        case .unknown:  return "unknown"
        @unknown default: return "unknown"
        }
    }

    private func mapNetwork(_ name: String) -> PKPaymentNetwork? {
        switch name {
        case "visa":           return .visa
        case "masterCard":     return .masterCard
        case "amex":           return .amex
        case "discover":       return .discover
        case "chinaUnionPay":  return .chinaUnionPay
        case "jcb":            return .JCB
        case "maestro":        return .maestro
        case "electron":       return .electron
        case "elo":            return .elo
        default: return nil
        }
    }

    private func mapContactField(_ field: String) -> PKContactField? {
        switch field {
        case "postalAddress": return .postalAddress
        case "name":          return .name
        case "phone":         return .phoneNumber
        case "email":         return .emailAddress
        default:              return nil
        }
    }

    private func serializeContact(_ contact: PKContact) -> [String: Any] {
        var result: [String: Any] = [:]

        if let name = contact.name {
            result["name"] = [
                "givenName": name.givenName ?? "",
                "familyName": name.familyName ?? "",
            ]
        }

        if let email = contact.emailAddress {
            result["emailAddress"] = email
        }

        if let phone = contact.phoneNumber {
            result["phoneNumber"] = phone.stringValue
        }

        if let address = contact.postalAddress {
            result["postalAddress"] = [
                "street": address.street,
                "city": address.city,
                "state": address.state,
                "postalCode": address.postalCode,
                "country": address.country,
                "isoCountryCode": address.isoCountryCode,
            ]
        }

        return result
    }
}
