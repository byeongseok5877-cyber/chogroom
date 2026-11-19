# 첫그루밍 랜딩 사이트 (가상 브랜드 · 수업용)

## 1. 내 컴퓨터에서 보기
터미널에서 이 폴더로 이동한 뒤:
    python3 -m http.server 8000
브라우저에서 http://localhost:8000 을 엽니다.

## 2. 배포 (둘 중 하나)
- Netlify: app.netlify.com/drop 에 이 폴더를 통째로 끌어다 놓기 → 주소가 바로 나옵니다.
- GitHub Pages: 새 저장소에 파일 올리기 → Settings > Pages > Branch: main / root.
배포 후 js/config.js 의 SITE_URL 을 실제 주소로 바꾸세요.

## 3. GA4 연결
1) GA4에서 웹 데이터 스트림을 만들고 측정 ID(G-로 시작)를 복사
2) js/config.js 의 GA_ID 에 붙여넣기 → 다시 배포
3) GA4 > 보고서 > 실시간 에서 확인. 사이트 주소 뒤에 ?debug=1 을 붙이면 화면 왼쪽 아래에 이벤트 로그 패널이 뜹니다.
측정 ID가 G-XXXXXXXXXX 그대로면 GA4로는 보내지 않고 콘솔·패널에만 기록합니다.

## 4. 이벤트
page_view / click_cta(cta_name: hero·benefit·bottom) / view_item / select_skin_type / add_to_cart / begin_checkout / purchase / sign_up
모든 이벤트에 variant(base 또는 top)가 붙습니다. purchase 에는 저장된 UTM(utm_source 등)이 함께 갑니다.

## 5. 테스트용 주소
- 경로 A: index.html → product.html → cart.html → checkout.html → done.html
- A/B: product.html?variant=top (타입 선택이 가격 바로 아래로 올라옴)
- UTM: index.html?utm_source=instagram&utm_medium=paid_social&utm_campaign=launch
        ?utm_source=naver_blog&utm_medium=content / ?utm_source=kakao&utm_medium=crm / ?utm_source=ai_search

모든 수치·후기·가격은 가상입니다. 개인정보는 저장·전송하지 않습니다.
