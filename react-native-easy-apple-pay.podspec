require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-easy-apple-pay"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.description  = <<-DESC
    A dead-simple, intuitive Apple Pay integration for React Native.
    Drop-in button component and useApplePay() hook for full control.
  DESC
  s.homepage     = package["homepage"] || "https://github.com/yourname/react-native-easy-apple-pay"
  s.license      = { :type => "MIT", :file => "LICENSE" }
  s.author       = package["author"].to_s.empty? ? "Your Name" : package["author"]
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/yourname/react-native-easy-apple-pay.git", :tag => "v#{s.version}" }
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.frameworks   = "PassKit"
  s.swift_version = "5.9"

  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "SWIFT_OBJC_INTERFACE_HEADER_NAME" => "RNEasyApplePay-Swift.h"
  }

  # New Architecture (TurboModules / Fabric) support.
  # install_modules_dependencies wires in React-Core, ReactCommon, RCT-Folly, etc.
  # for both old and new architectures. Falls back to the old behavior on RN <0.71.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end
