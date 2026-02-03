/**
 * add_tiers.js
 *
 * Reads rules_data.js, adds tier and claude_comment fields to each rule,
 * then writes back the updated file in the same format.
 *
 * Tier system:
 *   1 (필수)  - Real bugs, security, NPE, resource leaks, concurrency, critical design
 *   2 (권장)  - Best practices, maintainability, readability, common anti-patterns
 *   3 (선택)  - Style preferences, minor improvements, context-dependent
 *   "skip"   - Too restrictive, high false-positive, EJB/legacy-specific, outdated
 *
 * Usage: node add_tiers.js
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// TIER_MAP: All 290 rules with tier and claude_comment
// ---------------------------------------------------------------------------
const TIER_MAP = {
  // ==========================================================================
  // bestpractices
  // ==========================================================================
  AvoidReassigningParameters: {
    tier: 2,
    claude_comment:
      "권장 - 매개변수 재할당은 코드 가독성을 떨어뜨리고 의도치 않은 버그를 유발할 수 있습니다",
  },
  GuardLogStatement: {
    tier: 2,
    claude_comment:
      "권장 - 불필요한 문자열 연산을 방지하여 성능을 향상시킵니다. SLF4J 파라미터 치환 사용 권장",
  },
  ImplicitFunctionalInterface: {
    tier: 3,
    claude_comment:
      "선택 - @FunctionalInterface 명시는 좋은 관행이나 필수는 아닙니다",
  },
  AbstractClassWithoutAbstractMethod: {
    tier: 3,
    claude_comment:
      "선택 - 추상 메서드 없는 추상 클래스는 설계 의도가 불분명하나, 템플릿 패턴 등 합당한 경우도 있습니다",
  },
  AccessorClassGeneration: {
    tier: 3,
    claude_comment:
      "선택 - 불필요한 접근자 클래스 생성은 마이너한 최적화 이슈입니다",
  },
  AccessorMethodGeneration: {
    tier: 3,
    claude_comment:
      "선택 - 컴파일러가 생성하는 접근자 메서드에 대한 마이너한 최적화 규칙입니다",
  },
  ArrayIsStoredDirectly: {
    tier: 1,
    claude_comment:
      "필수 - 외부에서 전달된 배열을 직접 저장하면 캡슐화가 깨지고 예기치 않은 데이터 변경이 발생합니다",
  },
  AvoidMessageDigestField: {
    tier: 1,
    claude_comment:
      "필수 - MessageDigest를 필드로 사용하면 스레드 안전성 문제와 보안 취약점이 발생합니다",
  },
  AvoidPrintStackTrace: {
    tier: 1,
    claude_comment:
      "필수 - printStackTrace()는 운영 환경에서 로그 관리가 불가능하고 민감 정보가 노출될 수 있습니다",
  },
  AvoidReassigningCatchVariables: {
    tier: 2,
    claude_comment:
      "권장 - catch 변수 재할당은 원본 예외 정보를 잃어버릴 위험이 있습니다",
  },
  AvoidReassigningLoopVariables: {
    tier: 2,
    claude_comment:
      "권장 - 루프 변수 재할당은 무한 루프나 예기치 않은 동작을 유발할 수 있습니다",
  },
  AvoidStringBufferField: {
    tier: 2,
    claude_comment:
      "권장 - StringBuffer/StringBuilder를 필드로 사용하면 스레드 안전성 문제가 발생할 수 있습니다",
  },
  AvoidUsingHardCodedIP: {
    tier: 1,
    claude_comment:
      "필수 - 하드코딩된 IP 주소는 환경 이식성을 해치고 보안 위험을 초래합니다",
  },
  CheckResultSet: {
    tier: 1,
    claude_comment:
      "필수 - ResultSet.next() 확인 없이 접근하면 SQLException이 발생합니다",
  },
  ConstantsInInterface: {
    tier: 2,
    claude_comment:
      "권장 - 인터페이스에 상수를 정의하는 것은 안티패턴입니다. 별도 상수 클래스를 사용하세요",
  },
  DoubleBraceInitialization: {
    tier: 2,
    claude_comment:
      "권장 - 이중 중괄호 초기화는 익명 클래스를 생성하여 메모리 누수와 직렬화 문제를 유발합니다",
  },
  EnumComparison: {
    tier: 3,
    claude_comment:
      "선택 - Enum은 == 비교가 안전하지만, equals()도 정상 동작하므로 팀 컨벤션에 따르세요",
  },
  ExhaustiveSwitchHasDefault: {
    tier: 3,
    claude_comment:
      "선택 - 모든 케이스를 처리하는 switch에 default 추가 여부는 팀 스타일에 따라 결정하세요",
  },
  ForLoopCanBeForeach: {
    tier: 2,
    claude_comment:
      "권장 - enhanced for 루프는 가독성이 높고 인덱스 관련 오류를 방지합니다",
  },
  ForLoopVariableCount: {
    tier: 2,
    claude_comment:
      "권장 - for 루프에 변수가 많으면 복잡도가 증가하고 버그 발생 가능성이 높아집니다",
  },
  JUnit4SuitesShouldUseSuiteAnnotation: {
    tier: 3,
    claude_comment:
      "선택 - JUnit4 테스트 스위트 규칙으로, JUnit5 사용 시 해당되지 않습니다",
  },
  LabeledStatement: {
    tier: 2,
    claude_comment:
      "권장 - 레이블 문은 코드 흐름을 복잡하게 만들어 유지보수를 어렵게 합니다",
  },
  LiteralsFirstInComparisons: {
    tier: 2,
    claude_comment:
      "권장 - 리터럴을 먼저 두면 NPE를 방지할 수 있습니다 (Yoda 조건)",
  },
  LooseCoupling: {
    tier: 2,
    claude_comment:
      "권장 - 구현 클래스 대신 인터페이스 타입 사용으로 결합도를 낮추세요",
  },
  MethodReturnsInternalArray: {
    tier: 1,
    claude_comment:
      "필수 - 내부 배열을 직접 반환하면 캡슐화가 깨지고 외부에서 내부 상태를 변경할 수 있습니다",
  },
  MissingOverride: {
    tier: 2,
    claude_comment:
      "권장 - @Override 누락은 실수로 새 메서드를 정의하는 버그를 유발할 수 있습니다",
  },
  NonExhaustiveSwitch: {
    tier: 2,
    claude_comment:
      "권장 - 모든 케이스를 처리하지 않는 switch는 예기치 않은 동작을 유발합니다",
  },
  PreserveStackTrace: {
    tier: 1,
    claude_comment:
      "필수 - 스택 트레이스 보존은 운영 환경에서 장애 분석에 필수적입니다",
  },
  PrimitiveWrapperInstantiation: {
    tier: 2,
    claude_comment:
      "권장 - new Integer() 대신 Integer.valueOf() 사용으로 캐싱 이점을 활용하세요",
  },
  RelianceOnDefaultCharset: {
    tier: 1,
    claude_comment:
      "필수 - 기본 문자셋 의존은 플랫폼 간 인코딩 버그를 유발합니다. 명시적으로 지정하세요",
  },
  ReplaceEnumerationWithIterator: {
    tier: 2,
    claude_comment:
      "권장 - Enumeration은 레거시 API입니다. Iterator를 사용하세요",
  },
  ReplaceHashtableWithMap: {
    tier: 2,
    claude_comment:
      "권장 - Hashtable은 레거시 클래스입니다. HashMap이나 ConcurrentHashMap을 사용하세요",
  },
  ReplaceVectorWithList: {
    tier: 2,
    claude_comment:
      "권장 - Vector는 레거시 클래스입니다. ArrayList나 CopyOnWriteArrayList를 사용하세요",
  },
  SimplifiableTestAssertion: {
    tier: 2,
    claude_comment:
      "권장 - 단순화 가능한 테스트 단언문은 가독성과 오류 메시지를 개선합니다",
  },
  UnitTestAssertionsShouldIncludeMessage: {
    tier: 3,
    claude_comment:
      "선택 - 단언문에 메시지 포함은 좋은 관행이나, 메서드명이 명확하면 생략 가능합니다",
  },
  UnitTestContainsTooManyAsserts: {
    tier: 3,
    claude_comment:
      "선택 - 단언문 수 제한은 팀 컨벤션에 따라 조정이 필요합니다",
  },
  UnitTestShouldIncludeAssert: {
    tier: 2,
    claude_comment:
      "권장 - 단언문 없는 테스트는 실제로 아무것도 검증하지 않는 무의미한 테스트입니다",
  },
  UnitTestShouldUseAfterAnnotation: {
    tier: 3,
    claude_comment:
      "선택 - tearDown() 대신 @After 사용은 JUnit4 스타일 선호도에 따릅니다",
  },
  UnitTestShouldUseBeforeAnnotation: {
    tier: 3,
    claude_comment:
      "선택 - setUp() 대신 @Before 사용은 JUnit4 스타일 선호도에 따릅니다",
  },
  UnitTestShouldUseTestAnnotation: {
    tier: 2,
    claude_comment:
      "권장 - @Test 어노테이션 누락은 테스트가 실행되지 않는 심각한 문제를 초래합니다",
  },
  UnnecessaryVarargsArrayCreation: {
    tier: 3,
    claude_comment:
      "선택 - 불필요한 가변인자 배열 생성 제거는 코드 간결성을 위한 마이너 개선입니다",
  },
  UnnecessaryWarningSuppression: {
    tier: 2,
    claude_comment:
      "권장 - 불필요한 @SuppressWarnings는 실제 경고를 무시하게 만들 수 있습니다",
  },
  UnusedAssignment: {
    tier: 2,
    claude_comment:
      "권장 - 사용되지 않는 할당은 논리 오류의 징후이거나 불필요한 코드입니다",
  },
  UnusedFormalParameter: {
    tier: 2,
    claude_comment:
      "권장 - 사용되지 않는 매개변수는 API 설계 문제를 나타낼 수 있습니다",
  },
  UnusedLabel: {
    tier: 2,
    claude_comment:
      "권장 - 사용되지 않는 레이블은 불필요한 코드이며 혼란을 유발합니다",
  },
  UnusedLocalVariable: {
    tier: 1,
    claude_comment:
      "필수 - 사용되지 않는 지역 변수는 높은 확률로 논리 오류의 징후입니다",
  },
  UnusedPrivateField: {
    tier: 2,
    claude_comment:
      "권장 - 사용되지 않는 private 필드는 데드 코드이며 유지보수를 어렵게 합니다",
  },
  UnusedPrivateMethod: {
    tier: 2,
    claude_comment:
      "권장 - 사용되지 않는 private 메서드는 데드 코드이며 제거해야 합니다",
  },
  UseCollectionIsEmpty: {
    tier: 2,
    claude_comment:
      "권장 - collection.size() == 0 대신 isEmpty() 사용이 의도가 명확하고 일부 구현에서 더 효율적입니다",
  },
  UseEnumCollections: {
    tier: 3,
    claude_comment:
      "선택 - EnumSet/EnumMap은 성능이 우수하나 적용 범위가 제한적입니다",
  },
  UseStandardCharsets: {
    tier: 2,
    claude_comment:
      "권장 - StandardCharsets 사용으로 UnsupportedEncodingException을 방지하세요",
  },
  UseTryWithResources: {
    tier: 1,
    claude_comment:
      "필수 - try-with-resources는 리소스 누수를 방지하는 필수 패턴입니다",
  },
  WhileLoopWithLiteralBoolean: {
    tier: 2,
    claude_comment:
      "권장 - while(true) 사용은 무한 루프 의도를 명확히 하고 종료 조건을 검토해야 합니다",
  },
  OneDeclarationPerLine: {
    tier: 3,
    claude_comment:
      "선택 - 한 줄에 하나의 선언은 가독성 향상에 도움되나 스타일 선호도 문제입니다",
  },
  UseVarargs: {
    tier: 3,
    claude_comment:
      "선택 - 가변인자 사용 제안은 API 호환성을 고려하여 신중하게 적용하세요",
  },

  // ==========================================================================
  // codestyle
  // ==========================================================================
  ClassNamingConventions: {
    tier: 2,
    claude_comment:
      "권장 - 일관된 클래스 명명 규칙은 팀 협업과 코드 가독성에 중요합니다",
  },
  EmptyMethodInAbstractClassShouldBeAbstract: {
    tier: 3,
    claude_comment:
      "선택 - 빈 메서드를 추상으로 변경하는 것은 설계 선호도에 따릅니다",
  },
  FieldNamingConventions: {
    tier: 2,
    claude_comment:
      "권장 - 일관된 필드 명명 규칙은 코드 이해도와 팀 협업에 중요합니다",
  },
  FinalParameterInAbstractMethod: {
    tier: 3,
    claude_comment:
      "선택 - 추상 메서드의 final 매개변수는 구현부에서 의미가 없어 불필요합니다",
  },
  FormalParameterNamingConventions: {
    tier: 2,
    claude_comment:
      "권장 - 일관된 매개변수 명명 규칙은 코드 가독성에 직접적으로 기여합니다",
  },
  LocalVariableNamingConventions: {
    tier: 2,
    claude_comment:
      "권장 - 일관된 지역 변수 명명 규칙은 코드 가독성을 높입니다",
  },
  MethodNamingConventions: {
    tier: 2,
    claude_comment:
      "권장 - 일관된 메서드 명명 규칙은 API 사용성과 가독성에 중요합니다",
  },
  ModifierOrder: {
    tier: 2,
    claude_comment:
      "권장 - Java 언어 사양에 정의된 수정자 순서를 따르면 일관성이 높아집니다",
  },
  AvoidUsingNativeCode: {
    tier: 2,
    claude_comment:
      "권장 - 네이티브 코드 사용은 이식성과 보안 문제를 유발할 수 있어 신중해야 합니다",
  },
  AtLeastOneConstructor: {
    tier: "skip",
    claude_comment:
      "스킵 - 기본 생성자로 충분한 경우가 많아 강제하면 오히려 불필요한 코드가 늘어납니다",
  },
  AvoidDollarSigns: {
    tier: 3,
    claude_comment:
      "선택 - 달러 기호는 내부 클래스용으로 예약되어 있으나 일반적으로 사용하지 않습니다",
  },
  AvoidProtectedFieldInFinalClass: {
    tier: 2,
    claude_comment:
      "권장 - final 클래스에서 protected 필드는 의미가 없어 접근 수준을 명확히 해야 합니다",
  },
  AvoidProtectedMethodInFinalClassNotExtending: {
    tier: 2,
    claude_comment:
      "권장 - final 클래스에서 protected 메서드는 의미가 없으므로 접근 수준을 조정하세요",
  },
  CallSuperInConstructor: {
    tier: 3,
    claude_comment:
      "선택 - 명시적 super() 호출은 스타일 선호도 문제이며 컴파일러가 자동 추가합니다",
  },
  CommentDefaultAccessModifier: {
    tier: 3,
    claude_comment:
      "선택 - default 접근 수준에 주석을 다는 것은 좋은 관행이나 강제하기엔 과합니다",
  },
  ConfusingTernary: {
    tier: 3,
    claude_comment:
      "선택 - 삼항 연산자의 부정 조건 사용 여부는 가독성 선호도에 따릅니다",
  },
  ControlStatementBraces: {
    tier: 2,
    claude_comment:
      "권장 - 제어문에 중괄호를 항상 사용하면 실수로 인한 버그를 방지합니다",
  },
  EmptyControlStatement: {
    tier: 2,
    claude_comment:
      "권장 - 빈 제어문은 대부분 실수이며, 의도적인 경우 주석으로 명시해야 합니다",
  },
  FieldDeclarationsShouldBeAtStartOfClass: {
    tier: 3,
    claude_comment:
      "선택 - 필드 위치는 팀 코딩 스타일에 따라 결정하세요",
  },
  ForLoopShouldBeWhileLoop: {
    tier: 3,
    claude_comment:
      "선택 - 초기화/증가 없는 for 루프를 while로 변경하는 것은 스타일 선호도입니다",
  },
  IdenticalCatchBranches: {
    tier: 2,
    claude_comment:
      "권장 - 동일한 catch 블록은 Java 7 multi-catch로 병합하여 코드를 간결하게 만드세요",
  },
  LambdaCanBeMethodReference: {
    tier: 3,
    claude_comment:
      "선택 - 메서드 참조 사용은 간결하나 가독성 선호도에 따라 결정하세요",
  },
  LinguisticNaming: {
    tier: 2,
    claude_comment:
      "권장 - 이름과 실제 동작이 일치하지 않으면 코드 이해에 심각한 혼란을 줍니다",
  },
  LocalVariableCouldBeFinal: {
    tier: 3,
    claude_comment:
      "선택 - 지역 변수의 final 선언은 불변성을 강조하나 팀 스타일에 따릅니다",
  },
  LongVariable: {
    tier: 3,
    claude_comment:
      "선택 - 변수명 길이 제한은 주관적이며 오히려 긴 이름이 명확할 수 있습니다",
  },
  MethodArgumentCouldBeFinal: {
    tier: 3,
    claude_comment:
      "선택 - 메서드 인자의 final 선언은 불변성을 강조하나 코드가 장황해질 수 있습니다",
  },
  NoPackage: {
    tier: 1,
    claude_comment:
      "필수 - 패키지 선언 없는 클래스는 네임스페이스 충돌과 접근 제어 문제를 유발합니다",
  },
  OnlyOneReturn: {
    tier: "skip",
    claude_comment:
      "스킵 - 단일 return 강제는 오히려 복잡한 중첩 구조를 만들어 가독성을 해칩니다",
  },
  PackageCase: {
    tier: 2,
    claude_comment:
      "권장 - 패키지명은 소문자여야 하며 Java 표준 명명 규칙입니다",
  },
  PrematureDeclaration: {
    tier: 3,
    claude_comment:
      "선택 - 변수의 조기 선언 회피는 가독성 향상에 도움되나 마이너한 개선입니다",
  },
  ShortMethodName: {
    tier: 3,
    claude_comment:
      "선택 - 짧은 메서드명 제한은 유틸리티 메서드 등에서 거짓 양성이 많습니다",
  },
  ShortVariable: {
    tier: 3,
    claude_comment:
      "선택 - 짧은 변수명 제한은 루프 변수(i, j) 등에서 거짓 양성이 많습니다",
  },
  TooManyStaticImports: {
    tier: 2,
    claude_comment:
      "권장 - 과도한 static import는 코드의 출처를 파악하기 어렵게 만듭니다",
  },
  UnnecessaryAnnotationValueElement: {
    tier: 3,
    claude_comment:
      "선택 - 불필요한 어노테이션 value 요소 제거는 마이너한 코드 정리입니다",
  },
  UnnecessaryBoxing: {
    tier: 2,
    claude_comment:
      "권장 - 불필요한 박싱/언박싱은 성능 저하와 NPE 위험을 유발합니다",
  },
  UnnecessaryCast: {
    tier: 2,
    claude_comment:
      "권장 - 불필요한 캐스팅은 코드 가독성을 저하시키며 제거해야 합니다",
  },
  UnnecessaryConstructor: {
    tier: 3,
    claude_comment:
      "선택 - 기본 생성자와 동일한 생성자 제거는 마이너한 코드 정리입니다",
  },
  UnnecessaryLocalBeforeReturn: {
    tier: 3,
    claude_comment:
      "선택 - return 전 불필요한 지역 변수 제거 여부는 디버깅 편의성과 트레이드오프입니다",
  },
  UnnecessaryModifier: {
    tier: 3,
    claude_comment:
      "선택 - 불필요한 수정자 제거는 코드 정리 수준의 마이너 개선입니다",
  },
  UnnecessaryReturn: {
    tier: 3,
    claude_comment:
      "선택 - void 메서드 끝의 불필요한 return은 마이너한 스타일 이슈입니다",
  },
  UnnecessarySemicolon: {
    tier: 3,
    claude_comment:
      "선택 - 불필요한 세미콜론은 마이너한 스타일 이슈입니다",
  },
  UseDiamondOperator: {
    tier: 2,
    claude_comment:
      "권장 - 다이아몬드 연산자 사용은 Java 7+ 표준이며 가독성을 향상시킵니다",
  },
  UseExplicitTypes: {
    tier: 3,
    claude_comment:
      "선택 - var 대신 명시적 타입 사용 여부는 팀 컨벤션에 따라 결정하세요",
  },
  UselessQualifiedThis: {
    tier: 3,
    claude_comment:
      "선택 - 불필요한 qualified this 제거는 마이너한 코드 정리입니다",
  },
  UseShortArrayInitializer: {
    tier: 3,
    claude_comment:
      "선택 - 축약 배열 초기화 사용은 스타일 선호도 문제입니다",
  },
  UseUnderscoresInNumericLiterals: {
    tier: 3,
    claude_comment:
      "선택 - 숫자 리터럴의 밑줄 사용은 가독성 향상에 도움되나 선택사항입니다",
  },
  VariableCanBeInlined: {
    tier: 3,
    claude_comment:
      "선택 - 변수 인라이닝은 가독성과 디버깅 편의성의 트레이드오프입니다",
  },
  BooleanGetMethodName: {
    tier: 3,
    claude_comment:
      "선택 - boolean 반환 메서드의 is/has 접두사 사용은 스타일 선호도입니다",
  },
  ExtendsObject: {
    tier: 3,
    claude_comment:
      "선택 - 명시적 Object 상속 제거는 마이너한 코드 정리입니다",
  },
  GenericsNaming: {
    tier: 3,
    claude_comment:
      "선택 - 제네릭 타입 파라미터 명명은 단일 문자가 관례이나 강제할 필요는 없습니다",
  },
  LocalHomeNamingConvention: {
    tier: "skip",
    claude_comment:
      "스킵 - EJB 전용 규칙으로 현대적인 Spring 기반 프로젝트에는 불필요합니다",
  },
  LocalInterfaceSessionNamingConvention: {
    tier: "skip",
    claude_comment:
      "스킵 - EJB 전용 규칙으로 현대적인 Spring 기반 프로젝트에는 불필요합니다",
  },
  MDBAndSessionBeanNamingConvention: {
    tier: "skip",
    claude_comment:
      "스킵 - EJB 전용 규칙으로 현대적인 Spring 기반 프로젝트에는 불필요합니다",
  },
  RemoteInterfaceNamingConvention: {
    tier: "skip",
    claude_comment:
      "스킵 - EJB 전용 규칙으로 현대적인 Spring 기반 프로젝트에는 불필요합니다",
  },
  RemoteSessionInterfaceNamingConvention: {
    tier: "skip",
    claude_comment:
      "스킵 - EJB 전용 규칙으로 현대적인 Spring 기반 프로젝트에는 불필요합니다",
  },
  ShortClassName: {
    tier: 3,
    claude_comment:
      "선택 - 짧은 클래스명 제한은 DTO, VO 등 관례적 이름에서 거짓 양성이 많습니다",
  },
  TypeParameterNamingConventions: {
    tier: 3,
    claude_comment:
      "선택 - 타입 파라미터 명명 규칙은 기본 관례(T, E, K, V)를 따르는 것이 일반적입니다",
  },
  UnnecessaryFullyQualifiedName: {
    tier: 3,
    claude_comment:
      "선택 - 불필요한 정규화된 이름 제거는 마이너한 가독성 개선입니다",
  },
  UnnecessaryImport: {
    tier: 2,
    claude_comment:
      "권장 - 불필요한 import는 IDE에서 자동 정리 가능하며 코드를 깔끔하게 유지해야 합니다",
  },
  UselessParentheses: {
    tier: 3,
    claude_comment:
      "선택 - 불필요한 괄호 제거는 가독성 선호도에 따라 다릅니다. 명시적 괄호가 명확할 수도 있습니다",
  },

  // ==========================================================================
  // design
  // ==========================================================================
  AbstractClassWithoutAnyMethod: {
    tier: 2,
    claude_comment:
      "권장 - 메서드 없는 추상 클래스는 설계 결함의 징후이며 인터페이스나 상수 클래스로 변경을 검토하세요",
  },
  AvoidThrowingNullPointerException: {
    tier: 1,
    claude_comment:
      "필수 - NPE를 명시적으로 던지는 것은 안티패턴입니다. IllegalArgumentException 등을 사용하세요",
  },
  AvoidThrowingRawExceptionTypes: {
    tier: 1,
    claude_comment:
      "필수 - Exception/RuntimeException 직접 throw는 예외 처리를 불가능하게 만듭니다",
  },
  ClassWithOnlyPrivateConstructorsShouldBeFinal: {
    tier: 2,
    claude_comment:
      "권장 - private 생성자만 있는 클래스는 final로 선언하여 의도를 명확히 하세요",
  },
  AvoidRethrowingException: {
    tier: 2,
    claude_comment:
      "권장 - 예외를 그대로 다시 던지는 것은 불필요한 catch 블록이며 제거해야 합니다",
  },
  AvoidThrowingNewInstanceOfSameException: {
    tier: 2,
    claude_comment:
      "권장 - 같은 예외를 새로 생성하여 던지면 원본 스택 트레이스가 손실됩니다",
  },
  AvoidUncheckedExceptionsInSignatures: {
    tier: 3,
    claude_comment:
      "선택 - unchecked exception을 시그니처에 선언하는 것은 문서화 목적으로 유용할 수 있습니다",
  },
  CognitiveComplexity: {
    tier: 2,
    claude_comment:
      "권장 - 높은 인지 복잡도는 코드 이해를 어렵게 하며 리팩토링이 필요합니다",
  },
  CollapsibleIfStatements: {
    tier: 3,
    claude_comment:
      "선택 - 합칠 수 있는 if문 병합은 가독성 선호도에 따라 결정하세요",
  },
  CouplingBetweenObjects: {
    tier: 2,
    claude_comment:
      "권장 - 높은 객체 간 결합도는 유지보수를 어렵게 하며 리팩토링이 필요합니다",
  },
  CyclomaticComplexity: {
    tier: 2,
    claude_comment:
      "권장 - 높은 순환 복잡도는 버그 발생 가능성을 높이며 메서드 분리가 필요합니다",
  },
  DataClass: {
    tier: 3,
    claude_comment:
      "선택 - DTO/VO 패턴에서 데이터만 가진 클래스는 합당한 설계입니다",
  },
  DoNotExtendJavaLangError: {
    tier: 1,
    claude_comment:
      "필수 - java.lang.Error 확장은 시스템 레벨 오류와 혼동을 유발하며 절대 하면 안 됩니다",
  },
  ExceptionAsFlowControl: {
    tier: 1,
    claude_comment:
      "필수 - 예외를 흐름 제어로 사용하면 성능 저하와 코드 이해도 하락을 유발합니다",
  },
  ExcessiveImports: {
    tier: 3,
    claude_comment:
      "선택 - import 수 제한은 클래스 역할 범위에 따라 다르며 거짓 양성이 있을 수 있습니다",
  },
  ExcessiveParameterList: {
    tier: 2,
    claude_comment:
      "권장 - 매개변수가 너무 많으면 사용하기 어렵고 객체로 그룹화해야 합니다",
  },
  ExcessivePublicCount: {
    tier: 3,
    claude_comment:
      "선택 - public 멤버 수 제한은 클래스 특성에 따라 조정이 필요합니다",
  },
  FinalFieldCouldBeStatic: {
    tier: 3,
    claude_comment:
      "선택 - final 필드를 static으로 변경하는 것은 메모리 최적화이나 의미 변경을 유발할 수 있습니다",
  },
  GodClass: {
    tier: 2,
    claude_comment:
      "권장 - God Class는 단일 책임 원칙을 위반하며 분리 리팩토링이 필요합니다",
  },
  ImmutableField: {
    tier: 2,
    claude_comment:
      "권장 - 변경되지 않는 필드는 final로 선언하여 불변성을 보장하세요",
  },
  InvalidJavaBean: {
    tier: 3,
    claude_comment:
      "선택 - JavaBean 규약 준수는 프레임워크 요구사항에 따라 다릅니다",
  },
  LawOfDemeter: {
    tier: 3,
    claude_comment:
      "선택 - 디미터 법칙 엄격 적용은 거짓 양성이 매우 많아 실용적이지 않습니다",
  },
  LogicInversion: {
    tier: 3,
    claude_comment:
      "선택 - 논리 반전 제거는 가독성 선호도에 따라 결정하세요",
  },
  LoosePackageCoupling: {
    tier: 3,
    claude_comment:
      "선택 - 패키지 간 결합도 제한은 설정이 복잡하고 프로젝트 구조에 따라 다릅니다",
  },
  MutableStaticState: {
    tier: 1,
    claude_comment:
      "필수 - 가변 static 상태는 스레드 안전성 문제와 예측 불가능한 동작을 유발합니다",
  },
  NcssCount: {
    tier: 3,
    claude_comment:
      "선택 - 코드 행 수 제한은 메서드 특성에 따라 유연하게 조정이 필요합니다",
  },
  NPathComplexity: {
    tier: 2,
    claude_comment:
      "권장 - 높은 NPath 복잡도는 테스트하기 어려운 코드를 의미하며 리팩토링이 필요합니다",
  },
  PublicMemberInNonPublicType: {
    tier: 3,
    claude_comment:
      "선택 - 비공개 타입의 public 멤버는 접근 수준 불일치이나 인터페이스 구현 시 필요할 수 있습니다",
  },
  SignatureDeclareThrowsException: {
    tier: 2,
    claude_comment:
      "권장 - throws Exception 선언은 호출자가 적절한 예외 처리를 할 수 없게 만듭니다",
  },
  SimplifiedTernary: {
    tier: 3,
    claude_comment:
      "선택 - 삼항 연산자 단순화는 마이너한 가독성 개선입니다",
  },
  SimplifyBooleanExpressions: {
    tier: 2,
    claude_comment:
      "권장 - 복잡한 boolean 표현식 단순화는 가독성과 유지보수성을 크게 향상시킵니다",
  },
  SimplifyBooleanReturns: {
    tier: 2,
    claude_comment:
      "권장 - if(cond) return true; else return false; 패턴은 return cond;로 단순화하세요",
  },
  SimplifyConditional: {
    tier: 2,
    claude_comment:
      "권장 - 조건문 단순화는 코드 이해도를 높이고 버그 발생 가능성을 줄입니다",
  },
  SingularField: {
    tier: 2,
    claude_comment:
      "권장 - 하나의 메서드에서만 사용되는 필드는 지역 변수로 변경하세요",
  },
  SwitchDensity: {
    tier: 3,
    claude_comment:
      "선택 - switch 밀도 측정은 메트릭 기반 규칙이며 컨텍스트에 따라 다릅니다",
  },
  TooManyFields: {
    tier: 2,
    claude_comment:
      "권장 - 필드가 너무 많은 클래스는 분리가 필요하며 단일 책임 원칙을 위반합니다",
  },
  TooManyMethods: {
    tier: 3,
    claude_comment:
      "선택 - 메서드 수 제한은 getter/setter 포함 시 거짓 양성이 많습니다",
  },
  UselessOverridingMethod: {
    tier: 2,
    claude_comment:
      "권장 - 부모 메서드를 그대로 호출하는 오버라이딩은 불필요한 코드입니다",
  },
  UseObjectForClearerAPI: {
    tier: 3,
    claude_comment:
      "선택 - 매개변수 객체화 제안은 유용하나 모든 경우에 적합하지 않습니다",
  },
  UseUtilityClass: {
    tier: 2,
    claude_comment:
      "권장 - static 메서드만 있는 클래스는 유틸리티 클래스로 만들어 인스턴스 생성을 방지하세요",
  },

  // ==========================================================================
  // documentation
  // ==========================================================================
  CommentContent: {
    tier: 3,
    claude_comment:
      "선택 - 주석 내용 검사는 특정 단어 필터링으로 팀 정책에 따라 적용하세요",
  },
  CommentRequired: {
    tier: 3,
    claude_comment:
      "선택 - 주석 필수화는 무의미한 주석을 양산할 수 있어 코드 자체가 문서가 되도록 작성하세요",
  },
  CommentSize: {
    tier: 3,
    claude_comment:
      "선택 - 주석 크기 제한은 팀 컨벤션에 따라 유연하게 설정하세요",
  },
  DanglingJavadoc: {
    tier: 3,
    claude_comment:
      "선택 - 대상 없는 Javadoc 주석은 정리하는 것이 좋으나 마이너 이슈입니다",
  },
  UncommentedEmptyConstructor: {
    tier: 3,
    claude_comment:
      "선택 - 빈 생성자에 주석을 다는 것은 좋은 관행이나 강제할 필요는 없습니다",
  },
  UncommentedEmptyMethodBody: {
    tier: 2,
    claude_comment:
      "권장 - 빈 메서드 바디는 의도적임을 주석으로 명시하지 않으면 실수로 오인될 수 있습니다",
  },

  // ==========================================================================
  // errorprone
  // ==========================================================================
  ConstructorCallsOverridableMethod: {
    tier: 1,
    claude_comment:
      "필수 - 생성자에서 오버라이드 가능한 메서드 호출은 초기화 오류와 NPE를 유발합니다",
  },
  EqualsNull: {
    tier: 1,
    claude_comment:
      "필수 - x.equals(null) 대신 x == null을 사용하세요. equals(null)은 항상 false이며 NPE 위험이 있습니다",
  },
  ReturnEmptyCollectionRatherThanNull: {
    tier: 1,
    claude_comment:
      "필수 - null 대신 빈 컬렉션 반환으로 호출자의 NPE를 방지하세요",
  },
  AvoidAssertAsIdentifier: {
    tier: 2,
    claude_comment:
      "권장 - assert는 Java 예약어이므로 식별자로 사용하면 호환성 문제가 발생합니다",
  },
  AvoidBranchingStatementAsLastInLoop: {
    tier: 2,
    claude_comment:
      "권장 - 루프 마지막의 break/continue는 논리 오류의 징후일 가능성이 높습니다",
  },
  AvoidEnumAsIdentifier: {
    tier: 2,
    claude_comment:
      "권장 - enum은 Java 예약어이므로 식별자로 사용하면 호환성 문제가 발생합니다",
  },
  AvoidLosingExceptionInformation: {
    tier: 1,
    claude_comment:
      "필수 - 예외 정보 손실은 장애 분석을 불가능하게 만듭니다. 원인 예외를 항상 포함하세요",
  },
  AvoidMultipleUnaryOperators: {
    tier: 2,
    claude_comment:
      "권장 - 다중 단항 연산자(!!x, ~~y)는 가독성을 심각하게 해치며 버그 유발 가능성이 높습니다",
  },
  BrokenNullCheck: {
    tier: 1,
    claude_comment:
      "필수 - 잘못된 null 체크(&&와 || 혼동)는 NPE를 직접 유발하는 버그입니다",
  },
  DoNotCallGarbageCollectionExplicitly: {
    tier: 2,
    claude_comment:
      "권장 - System.gc() 명시적 호출은 성능을 저하시키며 JVM에 맡겨야 합니다",
  },
  MoreThanOneLogger: {
    tier: 3,
    claude_comment:
      "선택 - 다중 로거 사용은 특수한 경우 필요할 수 있어 컨텍스트에 따라 판단하세요",
  },
  ProperCloneImplementation: {
    tier: 2,
    claude_comment:
      "권장 - clone() 구현 시 super.clone() 호출은 올바른 클론 체인을 보장합니다",
  },
  SingleMethodSingleton: {
    tier: 2,
    claude_comment:
      "권장 - 싱글톤 패턴에서 단일 메서드 접근 보장은 인스턴스 일관성에 중요합니다",
  },
  SingletonClassReturningNewInstance: {
    tier: 1,
    claude_comment:
      "필수 - 싱글톤에서 새 인스턴스 반환은 싱글톤 계약을 위반하는 심각한 버그입니다",
  },
  SuspiciousEqualsMethodName: {
    tier: 1,
    claude_comment:
      "필수 - equals 메서드명 오타(equal, Equals 등)는 동등성 비교가 실패하는 심각한 버그를 유발합니다",
  },
  AssignmentInOperand: {
    tier: 2,
    claude_comment:
      "권장 - 조건문 내 할당은 비교(==)와 혼동되기 쉬운 일반적인 실수입니다",
  },
  AssignmentToNonFinalStatic: {
    tier: 1,
    claude_comment:
      "필수 - 비final static 변수에 대한 할당은 스레드 안전성 문제를 유발합니다",
  },
  AvoidAccessibilityAlteration: {
    tier: 1,
    claude_comment:
      "필수 - 리플렉션으로 접근성을 변경하면 캡슐화와 보안이 깨집니다",
  },
  AvoidCallingFinalize: {
    tier: "skip",
    claude_comment:
      "스킵 - finalize()는 Java 9에서 deprecated되었으며 현대 Java에서는 사용하지 않습니다",
  },
  AvoidCatchingGenericException: {
    tier: 2,
    claude_comment:
      "권장 - catch(Exception e)는 예기치 않은 예외까지 삼키므로 구체적 예외를 캐치하세요",
  },
  AvoidCatchingNPE: {
    tier: 1,
    claude_comment:
      "필수 - NPE를 catch하는 것은 null 체크로 방지해야 할 버그를 숨기는 행위입니다",
  },
  AvoidCatchingThrowable: {
    tier: 1,
    claude_comment:
      "필수 - Throwable catch는 Error까지 잡아 시스템 안정성을 해칩니다",
  },
  AvoidDecimalLiteralsInBigDecimalConstructor: {
    tier: 1,
    claude_comment:
      "필수 - new BigDecimal(0.1)은 정밀도 문제가 있습니다. BigDecimal.valueOf() 또는 문자열 생성자를 사용하세요",
  },
  AvoidDuplicateLiterals: {
    tier: 2,
    claude_comment:
      "권장 - 중복 리터럴은 상수로 추출하여 유지보수성을 높이세요",
  },
  AvoidFieldNameMatchingMethodName: {
    tier: 2,
    claude_comment:
      "권장 - 필드명과 메서드명이 같으면 코드 이해에 혼란을 줍니다",
  },
  AvoidFieldNameMatchingTypeName: {
    tier: 2,
    claude_comment:
      "권장 - 필드명과 타입명이 같으면 코드 가독성이 저하됩니다",
  },
  AvoidInstanceofChecksInCatchClause: {
    tier: 3,
    claude_comment:
      "선택 - catch에서 instanceof 대신 multi-catch 사용은 좋으나 레거시 호환 시 필요할 수 있습니다",
  },
  AvoidLiteralsInIfCondition: {
    tier: 3,
    claude_comment:
      "선택 - if 조건의 리터럴 사용 금지는 -1, 0, 1 등에서 거짓 양성이 많습니다",
  },
  AvoidUsingOctalValues: {
    tier: 1,
    claude_comment:
      "필수 - 8진수 리터럴(0으로 시작)은 의도치 않은 값을 생성하는 흔한 실수입니다",
  },
  CallSuperFirst: {
    tier: 3,
    claude_comment:
      "선택 - Android Activity 전용 규칙으로 일반 엔터프라이즈 프로젝트에서는 해당되지 않을 수 있습니다",
  },
  CallSuperLast: {
    tier: 3,
    claude_comment:
      "선택 - Android Activity 전용 규칙으로 일반 엔터프라이즈 프로젝트에서는 해당되지 않을 수 있습니다",
  },
  CheckSkipResult: {
    tier: 1,
    claude_comment:
      "필수 - InputStream.skip()의 반환값 미확인은 데이터 처리 오류를 유발합니다",
  },
  ClassCastExceptionWithToArray: {
    tier: 1,
    claude_comment:
      "필수 - toArray()의 잘못된 사용은 런타임 ClassCastException을 유발합니다",
  },
  CloneMethodMustBePublic: {
    tier: 2,
    claude_comment:
      "권장 - clone() 메서드는 Cloneable 계약에 따라 public이어야 합니다",
  },
  CloneMethodMustImplementCloneable: {
    tier: 2,
    claude_comment:
      "권장 - Cloneable 미구현 시 clone() 호출은 CloneNotSupportedException을 발생시킵니다",
  },
  CloneMethodReturnTypeMustMatchClassName: {
    tier: 2,
    claude_comment:
      "권장 - clone() 반환 타입이 현재 클래스와 일치해야 공변 반환 타입의 이점을 활용할 수 있습니다",
  },
  CloseResource: {
    tier: 1,
    claude_comment:
      "필수 - 리소스 미닫기는 메모리 누수, 커넥션 고갈 등 운영 장애를 직접 유발합니다",
  },
  CollectionTypeMismatch: {
    tier: 1,
    claude_comment:
      "필수 - 컬렉션 타입 불일치는 런타임 ClassCastException이나 항상 false를 반환하는 버그입니다",
  },
  CompareObjectsWithEquals: {
    tier: 1,
    claude_comment:
      "필수 - 객체를 == 대신 equals()로 비교해야 합니다. == 는 참조만 비교합니다",
  },
  ComparisonWithNaN: {
    tier: 1,
    claude_comment:
      "필수 - NaN과의 비교는 항상 false입니다. Double.isNaN()을 사용하세요",
  },
  ConfusingArgumentToVarargsMethod: {
    tier: 2,
    claude_comment:
      "권장 - 가변인자 메서드에 혼동되는 인자 전달은 의도치 않은 동작을 유발할 수 있습니다",
  },
  DetachedTestCase: {
    tier: 2,
    claude_comment:
      "권장 - @Test 어노테이션 없는 test 접두사 메서드는 실행되지 않는 테스트입니다",
  },
  DoNotExtendJavaLangThrowable: {
    tier: 1,
    claude_comment:
      "필수 - Throwable 직접 확장은 Exception이나 RuntimeException을 확장하세요",
  },
  DoNotHardCodeSDCard: {
    tier: "skip",
    claude_comment:
      "스킵 - Android 전용 규칙으로 서버사이드 엔터프라이즈 프로젝트에는 불필요합니다",
  },
  DoNotTerminateVM: {
    tier: 1,
    claude_comment:
      "필수 - System.exit() 호출은 서버 애플리케이션을 예기치 않게 종료시킵니다",
  },
  DontUseFloatTypeForLoopIndices: {
    tier: 1,
    claude_comment:
      "필수 - float 타입 루프 인덱스는 부동소수점 오차로 무한 루프를 유발합니다",
  },
  EmptyCatchBlock: {
    tier: 1,
    claude_comment:
      "필수 - 빈 catch 블록은 예외를 삼켜 장애 원인 분석을 불가능하게 만듭니다",
  },
  EmptyFinalizer: {
    tier: "skip",
    claude_comment:
      "스킵 - finalize()는 Java 9에서 deprecated되었으며 현대 Java에서는 사용하지 않습니다",
  },
  FinalizeDoesNotCallSuperFinalize: {
    tier: "skip",
    claude_comment:
      "스킵 - finalize()는 Java 9에서 deprecated되었으며 현대 Java에서는 사용하지 않습니다",
  },
  FinalizeOnlyCallsSuperFinalize: {
    tier: "skip",
    claude_comment:
      "스킵 - finalize()는 Java 9에서 deprecated되었으며 현대 Java에서는 사용하지 않습니다",
  },
  FinalizeOverloaded: {
    tier: "skip",
    claude_comment:
      "스킵 - finalize()는 Java 9에서 deprecated되었으며 현대 Java에서는 사용하지 않습니다",
  },
  FinalizeShouldBeProtected: {
    tier: "skip",
    claude_comment:
      "스킵 - finalize()는 Java 9에서 deprecated되었으며 현대 Java에서는 사용하지 않습니다",
  },
  IdempotentOperations: {
    tier: 1,
    claude_comment:
      "필수 - 멱등 연산(x = x, x + 0)은 논리 오류의 명확한 징후입니다",
  },
  IdenticalConditionalBranches: {
    tier: 1,
    claude_comment:
      "필수 - if/else의 동일한 브랜치는 복사-붙여넣기 실수이며 논리 오류입니다",
  },
  ImplicitSwitchFallThrough: {
    tier: 1,
    claude_comment:
      "필수 - switch fall-through 누락은 의도치 않은 동작을 유발하는 흔한 버그입니다",
  },
  JumbledIncrementer: {
    tier: 1,
    claude_comment:
      "필수 - 중첩 루프에서 잘못된 증감자 사용은 무한 루프나 잘못된 결과를 유발합니다",
  },
  JUnitSpelling: {
    tier: 2,
    claude_comment:
      "권장 - setUp/tearDown 오타는 테스트 초기화가 실행되지 않는 문제를 유발합니다",
  },
  JUnitStaticSuite: {
    tier: 3,
    claude_comment:
      "선택 - JUnit3 스타일의 suite() 메서드 규칙으로 JUnit5에서는 해당되지 않습니다",
  },
  MethodWithSameNameAsEnclosingClass: {
    tier: 1,
    claude_comment:
      "필수 - 클래스명과 같은 메서드는 생성자와 혼동되어 심각한 버그를 유발합니다",
  },
  MisplacedNullCheck: {
    tier: 1,
    claude_comment:
      "필수 - null 체크가 사용 이후에 있으면 NPE가 이미 발생한 후입니다",
  },
  MissingSerialVersionUID: {
    tier: 3,
    claude_comment:
      "선택 - serialVersionUID 누락은 직렬화 호환성에 영향을 주나, 직렬화를 사용하지 않으면 불필요합니다",
  },
  MissingStaticMethodInNonInstantiatableClass: {
    tier: 3,
    claude_comment:
      "선택 - 인스턴스화 불가 클래스에 static 메서드가 없는 것은 설계 문제의 징후이나 거짓 양성이 있습니다",
  },
  NonSerializableClass: {
    tier: 3,
    claude_comment:
      "선택 - Serializable 미구현 경고는 직렬화 사용 여부에 따라 결정하세요",
  },
  NonStaticInitializer: {
    tier: 2,
    claude_comment:
      "권장 - 인스턴스 초기화 블록은 가독성이 낮아 생성자에서 초기화하는 것이 좋습니다",
  },
  NullAssignment: {
    tier: 3,
    claude_comment:
      "선택 - null 할당 자체는 GC 힌트로 의도적일 수 있어 컨텍스트 판단이 필요합니다",
  },
  OverrideBothEqualsAndHashcode: {
    tier: 1,
    claude_comment:
      "필수 - equals()와 hashCode()를 함께 오버라이드하지 않으면 HashMap 등에서 심각한 버그가 발생합니다",
  },
  OverrideBothEqualsAndHashCodeOnComparable: {
    tier: 1,
    claude_comment:
      "필수 - Comparable 구현 시 equals/hashCode 미오버라이드는 정렬과 동등성 비교 불일치를 유발합니다",
  },
  ProperLogger: {
    tier: 2,
    claude_comment:
      "권장 - 로거는 클래스별로 올바르게 생성해야 로그 추적이 가능합니다",
  },
  ReplaceJavaUtilCalendar: {
    tier: 2,
    claude_comment:
      "권장 - java.util.Calendar은 레거시 API입니다. java.time 패키지를 사용하세요",
  },
  ReplaceJavaUtilDate: {
    tier: 2,
    claude_comment:
      "권장 - java.util.Date는 레거시 API입니다. java.time 패키지를 사용하세요",
  },
  ReturnFromFinallyBlock: {
    tier: 1,
    claude_comment:
      "필수 - finally에서 return하면 try/catch의 예외가 삼켜져 장애 분석이 불가능합니다",
  },
  SimpleDateFormatNeedsLocale: {
    tier: 2,
    claude_comment:
      "권장 - Locale 없는 SimpleDateFormat은 환경에 따라 다른 결과를 생성합니다",
  },
  StaticEJBFieldShouldBeFinal: {
    tier: "skip",
    claude_comment:
      "스킵 - EJB 전용 규칙으로 현대적인 Spring 기반 프로젝트에는 불필요합니다",
  },
  SuspiciousHashcodeMethodName: {
    tier: 1,
    claude_comment:
      "필수 - hashcode()/HashCode() 오타는 hashCode() 오버라이드 실패로 해시 기반 컬렉션에서 버그를 유발합니다",
  },
  SuspiciousOctalEscape: {
    tier: 1,
    claude_comment:
      "필수 - 의심스러운 8진수 이스케이프는 문자열에서 예기치 않은 문자를 생성합니다",
  },
  TestClassWithoutTestCases: {
    tier: 2,
    claude_comment:
      "권장 - 테스트 메서드 없는 테스트 클래스는 테스트가 실행되지 않는 문제를 나타냅니다",
  },
  UnconditionalIfStatement: {
    tier: 1,
    claude_comment:
      "필수 - if(true)/if(false)는 명백한 논리 오류이며 데드 코드입니다",
  },
  UnnecessaryBooleanAssertion: {
    tier: 2,
    claude_comment:
      "권장 - assertTrue(true) 같은 무의미한 단언은 테스트 품질을 저하시킵니다",
  },
  UnnecessaryCaseChange: {
    tier: 3,
    claude_comment:
      "선택 - equalsIgnoreCase 사용으로 불필요한 대소문자 변환을 제거하는 것은 마이너 개선입니다",
  },
  UnnecessaryConversionTemporary: {
    tier: 3,
    claude_comment:
      "선택 - 불필요한 변환용 임시 객체 제거는 마이너한 코드 정리입니다",
  },
  UnsupportedJdkApiUsage: {
    tier: 1,
    claude_comment:
      "필수 - 지원되지 않는 JDK API 사용은 런타임 오류를 유발합니다",
  },
  UnusedNullCheckInEquals: {
    tier: 2,
    claude_comment:
      "권장 - equals() 내 불필요한 null 체크는 코드를 복잡하게 만듭니다",
  },
  UseCorrectExceptionLogging: {
    tier: 2,
    claude_comment:
      "권장 - 올바른 예외 로깅 패턴을 사용해야 스택 트레이스가 보존됩니다",
  },
  UseEqualsToCompareStrings: {
    tier: 1,
    claude_comment:
      "필수 - 문자열을 == 로 비교하면 동일 내용이라도 false가 반환되는 심각한 버그입니다",
  },
  UselessOperationOnImmutable: {
    tier: 1,
    claude_comment:
      "필수 - 불변 객체(String, BigDecimal 등)에 대한 무의미한 연산은 결과가 버려지는 버그입니다",
  },
  UselessPureMethodCall: {
    tier: 1,
    claude_comment:
      "필수 - 순수 메서드 호출 결과를 사용하지 않으면 의도한 동작이 수행되지 않습니다",
  },
  UseLocaleWithCaseConversions: {
    tier: 2,
    claude_comment:
      "권장 - Locale 없는 대소문자 변환은 터키어 등에서 예기치 않은 결과를 생성합니다",
  },
  UseProperClassLoader: {
    tier: 2,
    claude_comment:
      "권장 - 올바른 ClassLoader 사용은 서버 환경에서 클래스 로딩 문제를 방지합니다",
  },
  DoNotThrowExceptionInFinally: {
    tier: 1,
    claude_comment:
      "필수 - finally에서 예외를 던지면 원래 예외가 소실되어 장애 분석이 불가능합니다",
  },
  DontImportSun: {
    tier: 2,
    claude_comment:
      "권장 - sun.* 패키지는 비공식 API이며 JDK 버전 간 호환이 보장되지 않습니다",
  },
  InstantiationToGetClass: {
    tier: 3,
    claude_comment:
      "선택 - new Foo().getClass() 대신 Foo.class 사용은 마이너 최적화입니다",
  },
  StringBufferInstantiationWithChar: {
    tier: 1,
    claude_comment:
      "필수 - new StringBuffer('c')는 char를 int로 변환하여 용량으로 사용하는 흔한 실수입니다",
  },
  InvalidLogMessageFormat: {
    tier: 1,
    claude_comment:
      "필수 - 잘못된 로그 메시지 포맷은 파라미터 불일치로 로그가 올바르게 기록되지 않습니다",
  },

  // ==========================================================================
  // multithreading
  // ==========================================================================
  DoubleCheckedLocking: {
    tier: 1,
    claude_comment:
      "필수 - DCL 패턴은 volatile 없이 사용하면 스레드 안전성이 보장되지 않는 유명한 동시성 버그입니다",
  },
  AvoidUsingVolatile: {
    tier: "skip",
    claude_comment:
      "스킵 - volatile은 올바르게 사용하면 유용한 동시성 도구이며 금지할 이유가 없습니다",
  },
  AvoidSynchronizedAtMethodLevel: {
    tier: 3,
    claude_comment:
      "선택 - 메서드 수준 synchronized 회피는 성능 최적화이나 간단한 경우 메서드 수준이 더 명확합니다",
  },
  AvoidSynchronizedStatement: {
    tier: "skip",
    claude_comment:
      "스킵 - synchronized 문 자체를 금지하는 것은 너무 제한적이며 올바른 동기화에 필요합니다",
  },
  AvoidThreadGroup: {
    tier: 2,
    claude_comment:
      "권장 - ThreadGroup은 레거시 API이며 스레드 관리에 ExecutorService를 사용하세요",
  },
  DoNotUseThreads: {
    tier: 3,
    claude_comment:
      "선택 - EJB/서블릿 컨테이너 전용 규칙이나, 일반적으로 ExecutorService 사용을 권장합니다",
  },
  NonThreadSafeSingleton: {
    tier: 1,
    claude_comment:
      "필수 - 스레드 안전하지 않은 싱글톤은 동시 접근 시 다중 인스턴스 생성 버그를 유발합니다",
  },
  UnsynchronizedStaticFormatter: {
    tier: 1,
    claude_comment:
      "필수 - 동기화되지 않은 static DateFormat은 멀티스레드 환경에서 잘못된 결과를 생성합니다",
  },
  UseConcurrentHashMap: {
    tier: 2,
    claude_comment:
      "권장 - 멀티스레드 환경에서 HashMap 대신 ConcurrentHashMap을 사용하세요",
  },
  UseNotifyAllInsteadOfNotify: {
    tier: 1,
    claude_comment:
      "필수 - notify() 대신 notifyAll()을 사용해야 데드락을 방지합니다",
  },
  DontCallThreadRun: {
    tier: 1,
    claude_comment:
      "필수 - thread.run() 직접 호출은 새 스레드를 시작하지 않는 흔한 실수입니다. start()를 사용하세요",
  },

  // ==========================================================================
  // performance
  // ==========================================================================
  AvoidFileStream: {
    tier: 2,
    claude_comment:
      "권장 - FileInputStream/FileOutputStream은 finalizer가 있어 GC 부하를 유발합니다. NIO Files 사용을 권장합니다",
  },
  StringInstantiation: {
    tier: 2,
    claude_comment:
      "권장 - new String()은 불필요한 객체를 생성합니다. 문자열 리터럴을 직접 사용하세요",
  },
  AddEmptyString: {
    tier: 3,
    claude_comment:
      "선택 - \"\" + x 대신 String.valueOf(x) 사용은 마이너 성능 개선입니다",
  },
  AppendCharacterWithChar: {
    tier: 3,
    claude_comment:
      "선택 - append(\"x\") 대신 append('x') 사용은 마이너 성능 개선입니다",
  },
  AvoidArrayLoops: {
    tier: 2,
    claude_comment:
      "권장 - 배열 복사에 루프 대신 System.arraycopy() 또는 Arrays.copyOf()를 사용하세요",
  },
  AvoidCalendarDateCreation: {
    tier: 2,
    claude_comment:
      "권장 - Calendar 인스턴스 생성은 비용이 높습니다. java.time API를 사용하세요",
  },
  AvoidInstantiatingObjectsInLoops: {
    tier: 2,
    claude_comment:
      "권장 - 루프 내 객체 생성은 GC 부하를 유발하며, 가능하면 루프 밖으로 이동하세요",
  },
  BigIntegerInstantiation: {
    tier: 2,
    claude_comment:
      "권장 - BigInteger.ZERO/ONE/TEN 상수를 사용하여 불필요한 인스턴스 생성을 방지하세요",
  },
  ConsecutiveAppendsShouldReuse: {
    tier: 3,
    claude_comment:
      "선택 - 연속 append() 체이닝은 마이너 성능 개선이며 가독성과 트레이드오프입니다",
  },
  ConsecutiveLiteralAppends: {
    tier: 3,
    claude_comment:
      "선택 - 연속 리터럴 append를 하나로 합치는 것은 마이너 최적화입니다",
  },
  InefficientEmptyStringCheck: {
    tier: 3,
    claude_comment:
      "선택 - 비효율적인 빈 문자열 체크 대신 isEmpty() 사용은 마이너 개선입니다",
  },
  InefficientStringBuffering: {
    tier: 2,
    claude_comment:
      "권장 - StringBuilder 안에서 + 연산을 사용하면 StringBuilder 사용 목적이 무효화됩니다",
  },
  InsufficientStringBufferDeclaration: {
    tier: 3,
    claude_comment:
      "선택 - StringBuffer 초기 용량 부족은 마이너 성능 이슈이며 자동 확장됩니다",
  },
  OptimizableToArrayCall: {
    tier: 3,
    claude_comment:
      "선택 - toArray() 최적화는 마이너 성능 개선입니다",
  },
  RedundantFieldInitializer: {
    tier: 3,
    claude_comment:
      "선택 - 기본값과 동일한 필드 초기화 제거는 스타일 선호도입니다",
  },
  StringToString: {
    tier: 2,
    claude_comment:
      "권장 - String.toString()은 무의미한 호출이며 제거해야 합니다",
  },
  UseArrayListInsteadOfVector: {
    tier: 2,
    claude_comment:
      "권장 - Vector는 레거시 동기화 컬렉션입니다. ArrayList 또는 CopyOnWriteArrayList를 사용하세요",
  },
  UseArraysAsList: {
    tier: 3,
    claude_comment:
      "선택 - Arrays.asList() 사용은 코드 간결성을 위한 마이너 개선입니다",
  },
  UseIndexOfChar: {
    tier: 3,
    claude_comment:
      "선택 - indexOf(String) 대신 indexOf(char) 사용은 마이너 성능 개선입니다",
  },
  UseIOStreamsWithApacheCommonsFileItem: {
    tier: 3,
    claude_comment:
      "선택 - Apache Commons FileItem 사용 시 스트림 기반 처리는 메모리 효율성을 위한 것입니다",
  },
  UselessStringValueOf: {
    tier: 3,
    claude_comment:
      "선택 - 불필요한 String.valueOf() 제거는 마이너 코드 정리입니다",
  },
  UseStringBufferForStringAppends: {
    tier: 2,
    claude_comment:
      "권장 - 루프 내 문자열 연결은 StringBuilder를 사용하여 성능을 개선하세요",
  },
  UseStringBufferLength: {
    tier: 3,
    claude_comment:
      "선택 - toString().length() 대신 length() 직접 사용은 마이너 최적화입니다",
  },

  // ==========================================================================
  // security
  // ==========================================================================
  HardCodedCryptoKey: {
    tier: 1,
    claude_comment:
      "필수 - 하드코딩된 암호화 키는 심각한 보안 취약점입니다. 키 관리 시스템을 사용하세요",
  },
  InsecureCryptoIv: {
    tier: 1,
    claude_comment:
      "필수 - 안전하지 않은 초기화 벡터(IV)는 암호화를 무력화하는 보안 취약점입니다",
  },
};

// ---------------------------------------------------------------------------
// Main script
// ---------------------------------------------------------------------------
function main() {
  const filePath = path.join(__dirname, "rules_data.js");

  // 1. Read rules_data.js
  const raw = fs.readFileSync(filePath, "utf8");

  // 2. Parse JSON (strip prefix and trailing semicolon)
  const jsonStr = raw.replace(/^const RULES_DATA =\s*/, "").replace(/;\s*$/, "");
  let rules;
  try {
    rules = JSON.parse(jsonStr);
  } catch (err) {
    console.error("Failed to parse rules_data.js:", err.message);
    process.exit(1);
  }

  console.log(`Loaded ${rules.length} rules from rules_data.js`);

  // Verify all rules are in TIER_MAP
  const tierMapKeys = new Set(Object.keys(TIER_MAP));
  const ruleNames = rules.map((r) => r.name);
  const missingFromMap = ruleNames.filter((name) => !tierMapKeys.has(name));
  const extraInMap = [...tierMapKeys].filter(
    (name) => !ruleNames.includes(name)
  );

  if (missingFromMap.length > 0) {
    console.error(
      `ERROR: ${missingFromMap.length} rules missing from TIER_MAP:`,
      missingFromMap
    );
    process.exit(1);
  }
  if (extraInMap.length > 0) {
    console.warn(
      `WARNING: ${extraInMap.length} extra entries in TIER_MAP not found in rules:`,
      extraInMap
    );
  }

  // 3. Add tier and claude_comment to each rule
  let tier1 = 0,
    tier2 = 0,
    tier3 = 0,
    tierSkip = 0;

  for (const rule of rules) {
    const tierInfo = TIER_MAP[rule.name];
    rule.tier = tierInfo.tier;
    rule.claude_comment = tierInfo.claude_comment;

    if (tierInfo.tier === 1) tier1++;
    else if (tierInfo.tier === 2) tier2++;
    else if (tierInfo.tier === 3) tier3++;
    else if (tierInfo.tier === "skip") tierSkip++;
  }

  console.log(`\nTier distribution:`);
  console.log(`  Tier 1 (필수): ${tier1}`);
  console.log(`  Tier 2 (권장): ${tier2}`);
  console.log(`  Tier 3 (선택): ${tier3}`);
  console.log(`  Skip:          ${tierSkip}`);
  console.log(`  Total:         ${tier1 + tier2 + tier3 + tierSkip}`);

  // 4. Write back in the same format
  const output = `const RULES_DATA =\n${JSON.stringify(rules, null, 2)};\n`;
  fs.writeFileSync(filePath, output, "utf8");

  console.log(`\nSuccessfully wrote updated rules_data.js`);
}

main();
